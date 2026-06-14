import 'dotenv/config';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import bcrypt from 'bcrypt';
import Fastify from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from './lib/prisma.js';

const PORT = Number(process.env.PORT) || 3000;

type StoreItem = {
  productId: number;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
};

const app = Fastify({ logger: true });

async function generateInvoiceNo(
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SF${year}`;

  const lastInvoice = await tx.invoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });

  let sequence = 1;
  if (lastInvoice) {
    const parsed = Number.parseInt(lastInvoice.invoiceNo.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) {
      sequence = parsed + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function previewNextInvoiceNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SF${year}`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });

  let sequence = 1;
  if (lastInvoice) {
    const parsed = Number.parseInt(lastInvoice.invoiceNo.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) {
      sequence = parsed + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function generatePurchaseInvoiceNo(
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AF${year}`;

  const lastInvoice = await tx.invoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });

  let sequence = 1;
  if (lastInvoice) {
    const parsed = Number.parseInt(lastInvoice.invoiceNo.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) {
      sequence = parsed + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function previewNextPurchaseInvoiceNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AF${year}`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });

  let sequence = 1;
  if (lastInvoice) {
    const parsed = Number.parseInt(lastInvoice.invoiceNo.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) {
      sequence = parsed + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

function calcLineTotalUsd(item: StoreItem): number {
  const discount = item.discountPercent ?? 0;
  const base = item.quantity * item.unitPrice;
  return base * (1 - discount / 100);
}

function calcLineTotalTl(item: StoreItem): number {
  const discount = item.discountPercent ?? 0;
  const base = item.quantity * item.unitPrice;
  return base * (1 - discount / 100);
}

function isCashLikePayment(method: string): boolean {
  return method === 'Nakit' || method === 'EFT/Havale' || method === 'Kart';
}

async function generateReturnInvoiceNo(
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IF${year}`;

  const lastInvoice = await tx.invoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });

  let sequence = 1;
  if (lastInvoice) {
    const parsed = Number.parseInt(lastInvoice.invoiceNo.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) {
      sequence = parsed + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

const DEPOT_NAMES = {
  MERKEZ: 'MERKEZ_DEPO',
  ARIZALI: 'ARIZALI_DEPO',
} as const;

async function getDepotBranchId(
  tx: Prisma.TransactionClient,
  depot: keyof typeof DEPOT_NAMES
): Promise<number> {
  const branch = await tx.branch.findFirst({
    where: { name: DEPOT_NAMES[depot] },
    select: { id: true },
  });
  if (!branch) {
    throw new Error(`${DEPOT_NAMES[depot]} şubesi bulunamadı.`);
  }
  return branch.id;
}

async function incrementStock(
  tx: Prisma.TransactionClient,
  productId: number,
  branchId: number,
  quantity: number
) {
  const existing = await tx.productStock.findUnique({
    where: { productId_branchId: { productId, branchId } },
  });

  if (existing) {
    await tx.productStock.update({
      where: { productId_branchId: { productId, branchId } },
      data: { quantity: { increment: quantity } },
    });
  } else {
    await tx.productStock.create({
      data: { productId, branchId, quantity },
    });
  }
}

function normalizeSearchTerm(search: string): string {
  return search.trim().toLocaleLowerCase('tr-TR');
}

function buildProductSearchWhere(search: string): Prisma.ProductWhereInput {
  const trimmed = search.trim();
  if (!trimmed) return {};

  const normalized = normalizeSearchTerm(trimmed);

  // MySQL Prisma sağlayıcısı mode: 'insensitive' desteklemez.
  // utf8mb4 collation + tr-TR normalize edilmiş terim ile çift yönlü arama yapılır.
  const termFilter = (term: string): Prisma.StringFilter => ({
    contains: term,
  });

  const terms = [...new Set([trimmed, normalized])];

  return {
    OR: terms.flatMap((term) => [
      { name: termFilter(term) },
      { sku: termFilter(term) },
      { barcode: termFilter(term) },
    ]),
  };
}

function toFloat(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DEFAULT_LIST_TAKE = 50;
const MAX_LIST_TAKE = 500;

function parseListPageQuery(query: {
  page?: string;
  limit?: string;
  take?: string;
  skip?: string;
}) {
  const limitRaw = Number(query.limit ?? query.take);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), MAX_LIST_TAKE)
      : DEFAULT_LIST_TAKE;

  let page = Number(query.page);
  if (!Number.isFinite(page) || page < 1) {
    const skipRaw = Number(query.skip);
    if (Number.isFinite(skipRaw) && skipRaw >= 0) {
      page = Math.floor(skipRaw / limit) + 1;
    } else {
      page = 1;
    }
  }

  page = Math.floor(page);
  const skip = (page - 1) * limit;

  return { limit, page, skip };
}

function buildListResponse<T>(
  data: T[],
  totalCount: number,
  limit: number,
  page: number
) {
  return {
    success: true,
    data,
    totalCount,
    limit,
    page,
    message: 'OK',
  };
}

function buildCustomerSearchWhere(search: string): Prisma.CustomerWhereInput {
  const trimmed = search.trim();
  if (!trimmed) return {};

  const normalized = normalizeSearchTerm(trimmed);
  const terms = [...new Set([trimmed, normalized])];

  return {
    OR: terms.flatMap((term) => [
      { name: { contains: term } },
      { code: { contains: term } },
    ]),
  };
}

app.register(cors, { origin: true });

const JWT_SECRET =
  process.env.JWT_SECRET ?? 'akgunteknik-dev-secret-degistirin';

app.register(jwt, { secret: JWT_SECRET });
app.register(rateLimit, { global: false });

const ADMIN_USERNAME = 'akgunteknik';
const ADMIN_PASSWORD = '123456';
const ADMIN_BCRYPT_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);

type AuthUserPayload = {
  sub: string;
  name: string;
  role: string;
};

async function issueAuthToken(
  reply: { jwtSign: (payload: AuthUserPayload, options?: { expiresIn: string }) => Promise<string> },
  user: AuthUserPayload
) {
  const token = await reply.jwtSign(user, { expiresIn: '7d' });
  return token;
}

app.post<{ Body: { username: string; password: string } }>(
  '/api/auth/login',
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  },
  async (request, reply) => {
    const { username, password } = request.body ?? {};
    const trimmedUsername = username?.trim();

    if (!trimmedUsername || !password) {
      return reply.status(400).send({
        success: false,
        message: 'Kullanıcı adı ve şifre zorunludur.',
        errors: null,
      });
    }

    if (trimmedUsername === ADMIN_USERNAME) {
      const valid =
        password === ADMIN_PASSWORD ||
        bcrypt.compareSync(password, ADMIN_BCRYPT_HASH);
      if (valid) {
        const token = await issueAuthToken(reply, {
          sub: ADMIN_USERNAME,
          name: 'Akgün Teknik',
          role: 'admin',
        });
        return {
          success: true,
          data: {
            token,
            user: {
              username: ADMIN_USERNAME,
              name: 'Akgün Teknik',
              role: 'admin',
            },
          },
          message: 'Giriş başarılı.',
        };
      }
    }

    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: trimmedUsername }, { name: trimmedUsername }],
      },
    });

    if (dbUser) {
      const stored = dbUser.password;
      const validPassword =
        stored.startsWith('$2') && bcrypt.compareSync(password, stored)
          ? true
          : stored === password;

      if (validPassword) {
        const token = await issueAuthToken(reply, {
          sub: String(dbUser.id),
          name: dbUser.name,
          role: dbUser.role,
        });
        return {
          success: true,
          data: {
            token,
            user: {
              username: dbUser.email,
              name: dbUser.name,
              role: dbUser.role,
            },
          },
          message: 'Giriş başarılı.',
        };
      }
    }

    return reply.status(401).send({
      success: false,
      message: 'Kullanıcı adı veya şifre hatalı.',
      errors: null,
    });
  }
);

app.get('/api/auth/me', async (request, reply) => {
  try {
    const payload = await request.jwtVerify<AuthUserPayload>();
    return {
      success: true,
      data: {
        username: payload.sub,
        name: payload.name,
        role: payload.role,
      },
      message: 'Oturum geçerli.',
    };
  } catch {
    return reply.status(401).send({
      success: false,
      message: 'Geçersiz veya süresi dolmuş oturum.',
      errors: null,
    });
  }
});

app.get('/api/sales/dashboard', async () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [safes, recentInvoices, recentPayments, salesInvoices] =
    await Promise.all([
      prisma.safe.findMany({
        select: {
          id: true,
          name: true,
          currency: true,
          balance: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.invoice.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      }),
      prisma.transaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          safe: { select: { id: true, name: true, currency: true } },
          customer: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.invoice.findMany({
        where: {
          type: 'SATIS',
          userId: { not: null },
          createdAt: { gte: startOfYear },
        },
        select: {
          userId: true,
          totalAmountTl: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

  type TurnoverEntry = {
    userId: number;
    userName: string;
    daily: number;
    monthly: number;
    yearly: number;
  };

  const turnoverMap = new Map<number, TurnoverEntry>();

  for (const invoice of salesInvoices) {
    if (!invoice.userId || !invoice.user) continue;

    const entry =
      turnoverMap.get(invoice.userId) ??
      ({
        userId: invoice.userId,
        userName: invoice.user.name,
        daily: 0,
        monthly: 0,
        yearly: 0,
      } satisfies TurnoverEntry);

    entry.yearly += invoice.totalAmountTl;

    if (invoice.createdAt >= startOfMonth) {
      entry.monthly += invoice.totalAmountTl;
    }

    if (invoice.createdAt >= startOfDay) {
      entry.daily += invoice.totalAmountTl;
    }

    turnoverMap.set(invoice.userId, entry);
  }

  const staffTurnover = Array.from(turnoverMap.values()).sort((a, b) =>
    a.userName.localeCompare(b.userName, 'tr')
  );

  const sevenDaysAgo = new Date(startOfDay);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [chartSales, chartPurchases, topProductRows, lowStockRows] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { type: 'SATIS', createdAt: { gte: sevenDaysAgo } },
        select: { totalAmountTl: true, createdAt: true },
      }),
      prisma.invoice.findMany({
        where: { type: 'SATIS', createdAt: { gte: sixMonthsAgo } },
        select: { totalAmountTl: true, createdAt: true },
      }),
      prisma.invoiceItem.findMany({
        where: {
          invoice: { type: 'SATIS', createdAt: { gte: thirtyDaysAgo } },
        },
        select: {
          quantity: true,
          product: { select: { name: true } },
        },
      }),
      prisma.branch
        .findFirst({
          where: { name: 'MERKEZ_DEPO' },
          select: { id: true },
        })
        .then(async (branch) => {
          if (!branch) return [];
          return prisma.productStock.findMany({
            where: { branchId: branch.id, quantity: { lte: 5 } },
            include: {
              product: { select: { id: true, sku: true, name: true } },
            },
            orderBy: { quantity: 'asc' },
            take: 15,
          });
        }),
    ]);

  const dailySalesMap = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    dailySalesMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const inv of chartSales) {
    const key = inv.createdAt.toISOString().slice(0, 10);
    if (dailySalesMap.has(key)) {
      dailySalesMap.set(key, (dailySalesMap.get(key) ?? 0) + inv.totalAmountTl);
    }
  }
  const dailySales = Array.from(dailySalesMap.entries()).map(([date, total]) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', {
      weekday: 'short',
      day: 'numeric',
    }),
    total,
  }));

  const monthlySalesMap = new Map<string, number>();
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlySalesMap.set(key, 0);
  }
  for (const inv of chartPurchases) {
    const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (monthlySalesMap.has(key)) {
      monthlySalesMap.set(
        key,
        (monthlySalesMap.get(key) ?? 0) + inv.totalAmountTl
      );
    }
  }
  const monthlySales = Array.from(monthlySalesMap.entries()).map(
    ([month, total]) => ({
      month,
      label: new Date(`${month}-01T12:00:00`).toLocaleDateString('tr-TR', {
        month: 'short',
        year: '2-digit',
      }),
      total,
    })
  );

  const productQtyMap = new Map<string, number>();
  for (const row of topProductRows) {
    const name = row.product.name;
    productQtyMap.set(name, (productQtyMap.get(name) ?? 0) + row.quantity);
  }
  const topProducts = Array.from(productQtyMap.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const lowStock = lowStockRows.map((row) => ({
    id: row.product.id,
    sku: row.product.sku,
    name: row.product.name,
    quantity: row.quantity,
  }));

  return {
    success: true,
    data: {
      safeBalances: safes,
      recentInvoices,
      recentPayments,
      staffTurnover,
      charts: {
        dailySales,
        monthlySales,
        topProducts,
        staffComparison: staffTurnover.map((s) => ({
          name: s.userName,
          monthly: s.monthly,
        })),
      },
      lowStock,
    },
    message: 'Dashboard data retrieved successfully.',
  };
});

app.get<{ Querystring: { type?: string } }>(
  '/api/sales/invoices',
  async (request) => {
    const { type } = request.query;

    const where: Prisma.InvoiceWhereInput =
      type && type !== 'ALL' ? { type } : {};

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return {
      success: true,
      data: invoices,
      message: 'Invoices retrieved successfully.',
    };
  }
);

app.get('/api/sales/init', async () => {
  const [branches, safes, personnels, nextInvoiceNo] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: 'asc' } }),
    prisma.safe.findMany({
      include: { branch: { select: { id: true, name: true, type: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    previewNextInvoiceNo(),
  ]);

  return {
    success: true,
    data: { branches, safes, personnels, nextInvoiceNo },
    message: 'Sales init data retrieved successfully.',
  };
});

app.get('/api/purchases/init', async () => {
  const [branches, safes, personnels, nextInvoiceNo] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: 'asc' } }),
    prisma.safe.findMany({
      include: { branch: { select: { id: true, name: true, type: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    previewNextPurchaseInvoiceNo(),
  ]);

  return {
    success: true,
    data: { branches, safes, personnels, nextInvoiceNo },
    message: 'Purchase init data retrieved successfully.',
  };
});

app.post<{
  Body: {
    customerId: number;
    branchId: number;
    safeId: number;
    paymentMethod: string;
    paymentType?: string;
    exchangeRate?: number;
    dueDate?: string;
    invoiceDate?: string;
    processedBy?: string;
    orderNotes?: string;
    items: StoreItem[];
  };
}>('/api/purchases/store', async (request, reply) => {
  const {
    customerId,
    branchId,
    safeId,
    paymentMethod,
    paymentType,
    exchangeRate,
    dueDate,
    invoiceDate,
    processedBy,
    orderNotes,
    items,
  } = request.body;

  if (!customerId || !branchId || !safeId || !paymentMethod || !items?.length) {
    return reply.status(400).send({
      success: false,
      message: 'Eksik veya geçersiz alış faturası bilgileri.',
      errors: null,
    });
  }

  const rate = exchangeRate && exchangeRate > 0 ? exchangeRate : 1;
  const totalAmountTl = items.reduce(
    (sum, item) => sum + calcLineTotalTl(item),
    0
  );
  const totalAmountUsd = totalAmountTl / rate;

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNo = await generatePurchaseInvoiceNo(tx);
      const stockBranchId = await getDepotBranchId(tx, 'MERKEZ');

      const matchedUser = processedBy
        ? await tx.user.findFirst({ where: { name: processedBy } })
        : null;

      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNo,
          type: 'ALIS',
          customerId,
          safeId,
          branchId,
          userId: matchedUser?.id,
          paymentMethod,
          paymentType: paymentType ?? null,
          exchangeRate: rate,
          deliveryType: 'Mağazadan Teslim',
          dueDate: dueDate ? new Date(dueDate) : null,
          processedBy: processedBy ?? null,
          orderNotes: orderNotes ?? null,
          totalAmountTl,
          totalAmountUsd,
          ...(invoiceDate ? { createdAt: new Date(invoiceDate) } : {}),
          items: {
            create: items.map((item) => {
              const lineTotal = calcLineTotalTl(item);
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPercent: item.discountPercent ?? 0,
                totalPrice: lineTotal,
              };
            }),
          },
        },
        include: { items: true },
      });

      for (const item of items) {
        await incrementStock(tx, item.productId, stockBranchId, item.quantity);

        await tx.product.update({
          where: { id: item.productId },
          data: {
            costPrice: item.unitPrice,
            priceUsd: item.unitPrice > 0 ? item.unitPrice / rate : 0,
          },
        });
      }

      if (isCashLikePayment(paymentMethod)) {
        await tx.safe.update({
          where: { id: safeId },
          data: { balance: { decrement: totalAmountTl } },
        });

        await tx.transaction.create({
          data: {
            safeId,
            customerId,
            type: 'CIKIS',
            amount: totalAmountTl,
            description: `${invoiceNo} alış ödemesi (${paymentMethod})`,
          },
        });
      } else if (paymentMethod === 'Cari') {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { decrement: totalAmountTl } },
        });
      }

      return createdInvoice;
    });

    return reply.status(201).send({
      success: true,
      data: invoice,
      message: 'Purchase invoice created successfully.',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Alış faturası kaydedilemedi.';
    return reply.status(500).send({
      success: false,
      message,
      errors: null,
    });
  }
});

app.get<{ Querystring: { search?: string; page?: string; limit?: string; take?: string; skip?: string } }>(
  '/api/customers',
  async (request) => {
    const { search, page, limit, take, skip } = request.query;
    const pagination = parseListPageQuery({ page, limit, take, skip });

    const where = search ? buildCustomerSearchWhere(search) : {};

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        take: pagination.limit,
        skip: pagination.skip,
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      ...buildListResponse(
        customers,
        totalCount,
        pagination.limit,
        pagination.page
      ),
      message: 'Customers retrieved successfully.',
    };
  }
);

app.post<{
  Body: {
    customerId: number;
    safeId: number;
    amount: number;
    type: 'GIRIS' | 'CIKIS';
    description?: string;
  };
}>('/api/customers/payment', async (request, reply) => {
  const { customerId, safeId, amount, type, description } = request.body;

  if (!customerId || !safeId || !amount || amount <= 0 || !type) {
    return reply.status(400).send({
      success: false,
      message: 'Eksik veya geçersiz ödeme bilgileri.',
      errors: null,
    });
  }

  if (type !== 'GIRIS' && type !== 'CIKIS') {
    return reply.status(400).send({
      success: false,
      message: 'Geçersiz işlem tipi. GIRIS veya CIKIS olmalı.',
      errors: null,
    });
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const [customer, safe] = await Promise.all([
        tx.customer.findUnique({ where: { id: customerId } }),
        tx.safe.findUnique({ where: { id: safeId } }),
      ]);

      if (!customer) {
        throw new Error('Müşteri bulunamadı.');
      }

      if (!safe) {
        throw new Error('Kasa bulunamadı.');
      }

      if (type === 'CIKIS' && safe.balance < amount) {
        throw new Error(
          `Kasa bakiyesi yetersiz. Mevcut: ${safe.balance}, istenen: ${amount}`
        );
      }

      if (type === 'GIRIS') {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { decrement: amount } },
        });
        await tx.safe.update({
          where: { id: safeId },
          data: { balance: { increment: amount } },
        });
      } else {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: amount } },
        });
        await tx.safe.update({
          where: { id: safeId },
          data: { balance: { decrement: amount } },
        });
      }

      return tx.transaction.create({
        data: {
          safeId,
          customerId,
          type,
          amount,
          description:
            description?.trim() ||
            (type === 'GIRIS'
              ? `${customer.code} cari tahsilat`
              : `${customer.code} cari ödeme`),
        },
        include: {
          customer: { select: { id: true, code: true, name: true, balance: true } },
          safe: { select: { id: true, name: true, currency: true, balance: true } },
        },
      });
    });

    return reply.status(201).send({
      success: true,
      data: payment,
      message: 'Payment recorded successfully.',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Ödeme kaydedilemedi.';
    return reply.status(500).send({
      success: false,
      message,
      errors: null,
    });
  }
});

app.get<{ Querystring: { search?: string; customerId?: string; exchangeRate?: string } }>(
  '/api/sales/products',
  async (request, reply) => {
    const { search, customerId, exchangeRate: exchangeRateQuery } = request.query;
    const parsedCustomerId = customerId ? Number(customerId) : null;
    const rate =
      exchangeRateQuery && Number(exchangeRateQuery) > 0
        ? Number(exchangeRateQuery)
        : 46.39;

    const trimmedSearch = search?.trim() ?? '';
    if (!trimmedSearch) {
      return {
        success: true,
        data: [],
        message: 'Arama terimi gerekli.',
      };
    }

    try {
      const where = buildProductSearchWhere(trimmedSearch);

      const products = await prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 50,
        select: {
          id: true,
          sku: true,
          barcode: true,
          name: true,
          costPrice: true,
          priceTl: true,
          priceUsd: true,
          stocks: {
            where: { branch: { name: DEPOT_NAMES.MERKEZ } },
            select: {
              quantity: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
      });

      const productsWithExtras = await Promise.all(
        products.map(async (product) => {
          let lastSoldPrice: number | null = null;
          let lastSoldPriceUsd: number | null = null;

          if (parsedCustomerId && !Number.isNaN(parsedCustomerId)) {
            const lastItem = await prisma.invoiceItem.findFirst({
              where: {
                productId: product.id,
                invoice: { customerId: parsedCustomerId, type: 'SATIS' },
              },
              orderBy: { invoice: { createdAt: 'desc' } },
              select: { unitPrice: true },
            });

            lastSoldPrice =
              lastItem?.unitPrice != null
                ? toFloat(lastItem.unitPrice)
                : null;

            if (lastSoldPrice != null) {
              const priceUsd = toFloat(product.priceUsd);
              lastSoldPriceUsd =
                lastSoldPrice > priceUsd * 4
                  ? lastSoldPrice / rate
                  : lastSoldPrice;
            }
          }

          const costUsd = toFloat(product.costPrice) / rate;

          const stocks = product.stocks.map((stock) => ({
            branchId: stock.branch.id,
            branchName: stock.branch.name,
            quantity: toFloat(stock.quantity),
          }));

          return {
            id: product.id,
            sku: product.sku,
            barcode: product.barcode,
            name: product.name,
            costPrice: toFloat(product.costPrice),
            costUsd,
            priceTl: toFloat(product.priceTl),
            priceUsd: toFloat(product.priceUsd),
            lastSoldPrice,
            lastSoldPriceUsd,
            stocks,
            merkezDepoQuantity: stocks[0]?.quantity ?? 0,
          };
        })
      );

      return {
        success: true,
        data: productsWithExtras,
        message: 'Products retrieved successfully.',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ürün araması başarısız.';
      return reply.status(500).send({
        success: false,
        data: [],
        message,
      });
    }
  }
);

app.post<{
  Body: {
    customerId: number;
    branchId: number;
    safeId: number;
    paymentMethod: string;
    paymentType?: string;
    exchangeRate: number;
    deliveryType?: string;
    dueDate?: string;
    invoiceDate?: string;
    isPreOrder?: boolean;
    processedBy?: string;
    orderNotes?: string;
    items: StoreItem[];
  };
}>('/api/sales/store', async (request, reply) => {
  const {
    customerId,
    branchId,
    safeId,
    paymentMethod,
    paymentType,
    exchangeRate,
    deliveryType,
    dueDate,
    invoiceDate,
    isPreOrder = false,
    processedBy,
    orderNotes,
    items,
  } = request.body;

  if (!customerId || !branchId || !safeId || !paymentMethod || !items?.length) {
    return reply.status(400).send({
      success: false,
      message: 'Eksik veya geçersiz istek gövdesi.',
      errors: null,
    });
  }

  const rate = exchangeRate > 0 ? exchangeRate : 1;
  const totalAmountUsd = items.reduce(
    (sum, item) => sum + calcLineTotalUsd(item),
    0
  );
  const totalAmountTl = totalAmountUsd * rate;

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNo = await generateInvoiceNo(tx);

      const matchedUser = processedBy
        ? await tx.user.findFirst({ where: { name: processedBy } })
        : null;

      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNo,
          type: 'SATIS',
          customerId,
          safeId,
          branchId,
          userId: matchedUser?.id,
          paymentMethod,
          paymentType: paymentType ?? null,
          exchangeRate: rate,
          deliveryType: deliveryType ?? 'Mağazadan Teslim',
          dueDate: dueDate ? new Date(dueDate) : null,
          isPreOrder,
          processedBy: processedBy ?? null,
          orderNotes: orderNotes ?? null,
          totalAmountTl,
          totalAmountUsd,
          ...(invoiceDate ? { createdAt: new Date(invoiceDate) } : {}),
          items: {
            create: items.map((item) => {
              const lineTotal = calcLineTotalUsd(item);
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountPercent: item.discountPercent ?? 0,
                totalPrice: lineTotal,
              };
            }),
          },
        },
        include: { items: true },
      });

      if (!isPreOrder) {
        const stockBranchId = await getDepotBranchId(tx, 'MERKEZ');

        for (const item of items) {
          const stock = await tx.productStock.findUnique({
            where: {
              productId_branchId: {
                productId: item.productId,
                branchId: stockBranchId,
              },
            },
          });

          if (!stock) {
            throw new Error(
              `Ürün #${item.productId} için MERKEZ_DEPO stok kaydı bulunamadı.`
            );
          }

          if (stock.quantity < item.quantity) {
            throw new Error(
              `Ürün #${item.productId} için yetersiz stok. Mevcut: ${stock.quantity}, istenen: ${item.quantity}`
            );
          }

          await tx.productStock.update({
            where: {
              productId_branchId: {
                productId: item.productId,
                branchId: stockBranchId,
              },
            },
            data: {
              quantity: { decrement: item.quantity },
            },
          });
        }
      }

      if (isCashLikePayment(paymentMethod)) {
        await tx.safe.update({
          where: { id: safeId },
          data: { balance: { increment: totalAmountTl } },
        });

        await tx.transaction.create({
          data: {
            safeId,
            customerId,
            type: 'GIRIS',
            amount: totalAmountTl,
            description: `${invoiceNo} satış tahsilatı (${paymentMethod})`,
          },
        });
      } else if (paymentMethod === 'Cari') {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: totalAmountTl } },
        });
      }

      return createdInvoice;
    });

    return reply.status(201).send({
      success: true,
      data: invoice,
      message: 'Invoice created successfully.',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Satış kaydedilemedi.';
    return reply.status(500).send({
      success: false,
      message,
      errors: null,
    });
  }
});

app.post<{
  Body: {
    customerId: number;
    branchId: number;
    safeId: number;
    exchangeRate?: number;
    isDefective: boolean;
    items: StoreItem[];
  };
}>('/api/sales/return', async (request, reply) => {
  const { customerId, branchId, safeId, exchangeRate, isDefective, items } =
    request.body;

  if (!customerId || !branchId || !safeId || !items?.length) {
    return reply.status(400).send({
      success: false,
      message: 'Eksik veya geçersiz iade bilgileri.',
      errors: null,
    });
  }

  const totalAmountTl = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const rate = exchangeRate && exchangeRate > 0 ? exchangeRate : 1;
  const totalAmountUsd = totalAmountTl / rate;

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNo = await generateReturnInvoiceNo(tx);
      const targetDepot = isDefective ? 'ARIZALI' : 'MERKEZ';
      const stockBranchId = await getDepotBranchId(tx, targetDepot);

      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNo,
          type: 'IADE',
          customerId,
          safeId,
          branchId,
          paymentMethod: 'Cari',
          exchangeRate: rate,
          deliveryType: 'Mağazadan Teslim',
          totalAmountTl,
          totalAmountUsd,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of items) {
        await incrementStock(
          tx,
          item.productId,
          stockBranchId,
          item.quantity
        );
      }

      await tx.customer.update({
        where: { id: customerId },
        data: { balance: { decrement: totalAmountTl } },
      });

      return createdInvoice;
    });

    return reply.status(201).send({
      success: true,
      data: invoice,
      message: 'Return recorded successfully.',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'İade kaydedilemedi.';
    return reply.status(500).send({
      success: false,
      message,
      errors: null,
    });
  }
});

app.post<{
  Body: {
    sku: string;
    name: string;
    costPrice: number;
    priceTl: number;
    barcode?: string;
    priceUsd?: number;
    initialQuantity?: number;
  };
}>('/api/products', async (request, reply) => {
  const { sku, name, costPrice, priceTl, barcode, priceUsd, initialQuantity } =
    request.body;

  if (!sku?.trim() || !name?.trim() || costPrice == null || priceTl == null) {
    return reply.status(400).send({
      success: false,
      message: 'SKU, ad, alış maliyeti ve satış fiyatı zorunludur.',
      errors: null,
    });
  }

  if (costPrice < 0 || priceTl < 0) {
    return reply.status(400).send({
      success: false,
      message: 'Fiyatlar negatif olamaz.',
      errors: null,
    });
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: sku.trim(),
          name: name.trim(),
          costPrice,
          priceTl,
          priceUsd: priceUsd ?? (priceTl > 0 ? priceTl / 46.37 : 0),
          barcode: barcode?.trim() || null,
        },
      });

      const merkezDepoId = await getDepotBranchId(tx, 'MERKEZ');
      await tx.productStock.create({
        data: {
          productId: created.id,
          branchId: merkezDepoId,
          quantity: initialQuantity ?? 0,
        },
      });

      await tx.productStock.create({
        data: {
          productId: created.id,
          branchId: await getDepotBranchId(tx, 'ARIZALI'),
          quantity: 0,
        },
      });

      return created;
    });

    return reply.status(201).send({
      success: true,
      data: product,
      message: 'Product created successfully.',
    });
  } catch {
    return reply.status(409).send({
      success: false,
      message: 'Ürün eklenemedi. SKU veya barkod benzersiz olmalı.',
      errors: null,
    });
  }
});

app.get<{ Querystring: { search?: string; page?: string; limit?: string; take?: string; skip?: string } }>(
  '/api/products',
  async (request) => {
    const { search, page, limit, take, skip } = request.query;
    const pagination = parseListPageQuery({ page, limit, take, skip });

    const where = search ? buildProductSearchWhere(search) : {};

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          stocks: {
            include: {
              branch: {
                select: { id: true, name: true, type: true },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      ...buildListResponse(
        products,
        totalCount,
        pagination.limit,
        pagination.page
      ),
      message: 'Products retrieved successfully.',
    };
  }
);

app.post<{
  Body: {
    productId: number;
    fromBranchId?: number;
    toBranchId: number;
    quantity: number;
  };
}>('/api/products/stock-movement', async (request, reply) => {
  const { productId, fromBranchId, toBranchId, quantity } = request.body;

  if (!productId || !toBranchId || !quantity || quantity <= 0) {
    return reply.status(400).send({
      success: false,
      message: 'Eksik veya geçersiz stok hareketi bilgileri.',
      errors: null,
    });
  }

  if (fromBranchId && fromBranchId === toBranchId) {
    return reply.status(400).send({
      success: false,
      message: 'Kaynak ve hedef şube aynı olamaz.',
      errors: null,
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Error('Ürün bulunamadı.');
      }

      const toBranch = await tx.branch.findUnique({ where: { id: toBranchId } });
      if (!toBranch) {
        throw new Error('Hedef şube bulunamadı.');
      }

      if (fromBranchId) {
        const fromBranch = await tx.branch.findUnique({
          where: { id: fromBranchId },
        });
        if (!fromBranch) {
          throw new Error('Kaynak şube bulunamadı.');
        }

        const sourceStock = await tx.productStock.findUnique({
          where: {
            productId_branchId: {
              productId,
              branchId: fromBranchId,
            },
          },
        });

        if (!sourceStock) {
          throw new Error('Kaynak şubede stok kaydı bulunamadı.');
        }

        if (sourceStock.quantity < quantity) {
          throw new Error(
            `Kaynak şubede yetersiz stok. Mevcut: ${sourceStock.quantity}, istenen: ${quantity}`
          );
        }

        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId,
              branchId: fromBranchId,
            },
          },
          data: { quantity: { decrement: quantity } },
        });
      }

      const destStock = await tx.productStock.findUnique({
        where: {
          productId_branchId: {
            productId,
            branchId: toBranchId,
          },
        },
      });

      if (destStock) {
        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId,
              branchId: toBranchId,
            },
          },
          data: { quantity: { increment: quantity } },
        });
      } else {
        await tx.productStock.create({
          data: {
            productId,
            branchId: toBranchId,
            quantity,
          },
        });
      }

      return tx.product.findUnique({
        where: { id: productId },
        include: {
          stocks: {
            include: {
              branch: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });
    });

    return reply.status(201).send({
      success: true,
      data: result,
      message: 'Stock movement recorded successfully.',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Stok hareketi kaydedilemedi.';
    return reply.status(500).send({
      success: false,
      message,
      errors: null,
    });
  }
});

app.get('/api/reports/balances', async () => {
  const customers = await prisma.customer.findMany({
    orderBy: { balance: 'desc' },
    select: {
      id: true,
      code: true,
      name: true,
      creditLimit: true,
      balance: true,
    },
  });

  const totalReceivable = customers
    .filter((c) => c.balance > 0)
    .reduce((sum, c) => sum + c.balance, 0);

  const riskyTotalBalance = customers
    .filter((c) => c.balance > c.creditLimit)
    .reduce((sum, c) => sum + c.balance, 0);

  const debtorCount = customers.filter((c) => c.balance > 0).length;

  return {
    success: true,
    data: {
      totalReceivable,
      riskyTotalBalance,
      debtorCount,
      customers,
    },
    message: 'Balance report retrieved successfully.',
  };
});

app.get('/api/reports/profit', async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const invoiceItems = await prisma.invoiceItem.findMany({
    where: {
      invoice: { type: 'SATIS' },
    },
    include: {
      product: {
        select: { id: true, sku: true, name: true, costPrice: true, priceTl: true },
      },
      invoice: {
        select: { createdAt: true, customerId: true },
      },
    },
  });

  type ProductProfit = {
    productId: number;
    sku: string;
    name: string;
    quantitySold: number;
    revenue: number;
    profit: number;
  };

  type PeriodStats = {
    totalRevenue: number;
    totalProfit: number;
    profitMarginPercent: number;
    itemCount: number;
  };

  const calcPeriod = (items: typeof invoiceItems): PeriodStats => {
    let totalRevenue = 0;
    let totalProfit = 0;

    for (const item of items) {
      const revenue = item.quantity * item.unitPrice;
      const costBase = item.product.costPrice;
      const profit = (item.unitPrice - costBase) * item.quantity;
      totalRevenue += revenue;
      totalProfit += profit;
    }

    const profitMarginPercent =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalProfit,
      profitMarginPercent,
      itemCount: items.length,
    };
  };

  const monthItems = invoiceItems.filter(
    (item) => item.invoice.createdAt >= startOfMonth
  );

  const productMap = new Map<number, ProductProfit>();

  for (const item of monthItems) {
    const revenue = item.quantity * item.unitPrice;
    const profit = (item.unitPrice - item.product.costPrice) * item.quantity;

    const existing = productMap.get(item.productId);
    if (existing) {
      existing.quantitySold += item.quantity;
      existing.revenue += revenue;
      existing.profit += profit;
    } else {
      productMap.set(item.productId, {
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        quantitySold: item.quantity,
        revenue,
        profit,
      });
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.profit - a.profit)
    .map((p) => ({
      ...p,
      profitMarginPercent: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
    }));

  return {
    success: true,
    data: {
      thisMonth: calcPeriod(monthItems),
      allTime: calcPeriod(invoiceItems),
      topProducts,
    },
    message: 'Profit report retrieved successfully.',
  };
});

app.get('/api/settings/categories', async () => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: true, brandModels: true } },
      brandModels: { orderBy: { name: 'asc' } },
    },
  });

  return {
    success: true,
    data: categories,
    message: 'Categories retrieved successfully.',
  };
});

app.post<{ Body: { name: string } }>(
  '/api/settings/category',
  async (request, reply) => {
    const { name } = request.body;
    const trimmed = name?.trim();

    if (!trimmed) {
      return reply.status(400).send({
        success: false,
        message: 'Kategori adı zorunludur.',
        errors: null,
      });
    }

    try {
      const category = await prisma.category.create({
        data: { name: trimmed },
      });
      return reply.status(201).send({
        success: true,
        data: category,
        message: 'Category created successfully.',
      });
    } catch {
      return reply.status(409).send({
        success: false,
        message: 'Bu kategori adı zaten kayıtlı.',
        errors: null,
      });
    }
  }
);

app.get('/api/settings/brand-models', async () => {
  const brandModels = await prisma.brandModel.findMany({
    orderBy: { name: 'asc' },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { products: true } },
    },
  });

  return {
    success: true,
    data: brandModels,
    message: 'Brand models retrieved successfully.',
  };
});

app.post<{ Body: { name: string; categoryId?: number } }>(
  '/api/settings/brand-model',
  async (request, reply) => {
    const { name, categoryId } = request.body;
    const trimmed = name?.trim();

    if (!trimmed) {
      return reply.status(400).send({
        success: false,
        message: 'Marka/model adı zorunludur.',
        errors: null,
      });
    }

    try {
      const brandModel = await prisma.brandModel.create({
        data: {
          name: trimmed,
          categoryId: categoryId ?? null,
        },
        include: { category: { select: { id: true, name: true } } },
      });
      return reply.status(201).send({
        success: true,
        data: brandModel,
        message: 'Brand model created successfully.',
      });
    } catch {
      return reply.status(409).send({
        success: false,
        message: 'Bu marka/model zaten kayıtlı.',
        errors: null,
      });
    }
  }
);

app.get('/api/settings/safes', async () => {
  const safes = await prisma.safe.findMany({
    orderBy: { name: 'asc' },
    include: {
      branch: { select: { id: true, name: true, type: true } },
    },
  });

  return {
    success: true,
    data: safes,
    message: 'Safes retrieved successfully.',
  };
});

app.post<{
  Body: {
    branchId: number;
    name: string;
    currency?: string;
    balance?: number;
  };
}>('/api/settings/safe', async (request, reply) => {
  const { branchId, name, currency, balance } = request.body;
  const trimmed = name?.trim();

  if (!branchId || !trimmed) {
    return reply.status(400).send({
      success: false,
      message: 'Şube ve kasa adı zorunludur.',
      errors: null,
    });
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return reply.status(404).send({
      success: false,
      message: 'Şube bulunamadı.',
      errors: null,
    });
  }

  const safe = await prisma.safe.create({
    data: {
      branchId,
      name: trimmed,
      currency: currency ?? 'TRY',
      balance: balance ?? 0,
    },
    include: {
      branch: { select: { id: true, name: true, type: true } },
    },
  });

  return reply.status(201).send({
    success: true,
    data: safe,
    message: 'Safe created successfully.',
  });
});

app.get('/api/settings/personnels', async () => {
  const personnels = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { invoices: true } },
    },
  });

  return {
    success: true,
    data: personnels,
    message: 'Personnels retrieved successfully.',
  };
});

app.post<{
  Body: {
    name: string;
    email: string;
    password: string;
    role?: string;
  };
}>('/api/settings/personnel', async (request, reply) => {
  const { name, email, password, role } = request.body;
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim().toLowerCase();

  if (!trimmedName || !trimmedEmail || !password) {
    return reply.status(400).send({
      success: false,
      message: 'Ad, e-posta ve şifre zorunludur.',
      errors: null,
    });
  }

  try {
    const hashedPassword = password.startsWith('$2')
      ? password
      : bcrypt.hashSync(password, 10);
    const user = await prisma.user.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        password: hashedPassword,
        role: role ?? 'staff',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.status(201).send({
      success: true,
      data: user,
      message: 'Personnel created successfully.',
    });
  } catch {
    return reply.status(409).send({
      success: false,
      message: 'Bu e-posta adresi zaten kayıtlı.',
      errors: null,
    });
  }
});

app.put<{
  Params: { id: string };
  Body: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };
}>('/api/settings/personnel/:id', async (request, reply) => {
  const id = Number(request.params.id);
  const { name, email, password, role } = request.body;

  if (Number.isNaN(id)) {
    return reply.status(400).send({
      success: false,
      message: 'Geçersiz personel kimliği.',
      errors: null,
    });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return reply.status(404).send({
      success: false,
      message: 'Personel bulunamadı.',
      errors: null,
    });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(email?.trim() ? { email: email.trim().toLowerCase() } : {}),
        ...(password ? { password } : {}),
        ...(role ? { role } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: user,
      message: 'Personnel updated successfully.',
    };
  } catch {
    return reply.status(409).send({
      success: false,
      message: 'Güncelleme başarısız. E-posta başka bir kayıtta olabilir.',
      errors: null,
    });
  }
});

app.get('/api/settings/branches', async () => {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
  return {
    success: true,
    data: branches,
    message: 'Branches retrieved successfully.',
  };
});

app.get<{ Querystring: { page?: string; limit?: string } }>(
  '/api/reports/stock-history',
  async (request) => {
    const pagination = parseListPageQuery(request.query);
    const merkezDepo = await prisma.branch.findFirst({
      where: { name: 'MERKEZ_DEPO' },
      select: { id: true, name: true },
    });

    const [items, totalCount] = await Promise.all([
      prisma.invoiceItem.findMany({
        where: {
          invoice: { type: { in: ['SATIS', 'ALIS', 'IADE'] } },
        },
        orderBy: { invoice: { createdAt: 'desc' } },
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          product: { select: { id: true, sku: true, name: true } },
          invoice: {
            select: {
              invoiceNo: true,
              type: true,
              createdAt: true,
              customer: { select: { code: true, name: true } },
            },
          },
        },
      }),
      prisma.invoiceItem.count({
        where: { invoice: { type: { in: ['SATIS', 'ALIS', 'IADE'] } } },
      }),
    ]);

    const data = items.map((item) => {
      let direction: 'IN' | 'OUT' = 'IN';
      let depot = merkezDepo?.name ?? 'MERKEZ_DEPO';

      if (item.invoice.type === 'SATIS') {
        direction = 'OUT';
        depot = merkezDepo?.name ?? 'MERKEZ_DEPO';
      } else if (item.invoice.type === 'ALIS') {
        direction = 'IN';
        depot = merkezDepo?.name ?? 'MERKEZ_DEPO';
      } else if (item.invoice.type === 'IADE') {
        direction = 'IN';
        depot = merkezDepo?.name ?? 'MERKEZ_DEPO';
      }

      return {
        id: item.id,
        product: item.product,
        quantity: item.quantity,
        direction,
        depot,
        invoiceNo: item.invoice.invoiceNo,
        invoiceType: item.invoice.type,
        customer: item.invoice.customer,
        createdAt: item.invoice.createdAt,
      };
    });

    return buildListResponse(data, totalCount, pagination.limit, pagination.page);
  }
);

app.get('/api/reports/stock-value', async (request, reply) => {
  const stocks = await prisma.productStock.findMany({
    where: { branch: { name: 'MERKEZ_DEPO' } },
    include: {
      product: {
        select: { id: true, sku: true, name: true, costPrice: true, priceTl: true },
      },
    },
    orderBy: { product: { name: 'asc' } },
  });

  const rows = stocks.map((row) => ({
    productId: row.product.id,
    sku: row.product.sku,
    name: row.product.name,
    quantity: row.quantity,
    costPrice: row.product.costPrice,
    priceTl: row.product.priceTl,
    stockValue: row.quantity * row.product.costPrice,
    retailValue: row.quantity * row.product.priceTl,
  }));

  const totals = rows.reduce(
    (acc, row) => ({
      totalQuantity: acc.totalQuantity + row.quantity,
      totalCostValue: acc.totalCostValue + row.stockValue,
      totalRetailValue: acc.totalRetailValue + row.retailValue,
    }),
    { totalQuantity: 0, totalCostValue: 0, totalRetailValue: 0 }
  );

  if (request.headers.accept?.includes('text/csv')) {
    const header = 'SKU;Ürün;Adet;Maliyet;Stok Değeri;Perakende Değeri';
    const lines = rows.map(
      (r) =>
        `${r.sku};${r.name};${r.quantity};${r.costPrice};${r.stockValue.toFixed(2)};${r.retailValue.toFixed(2)}`
    );
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header(
      'Content-Disposition',
      'attachment; filename="stok-degeri.csv"'
    );
    return `${header}\n${lines.join('\n')}`;
  }

  return {
    success: true,
    data: { rows, totals },
    message: 'Stock value report retrieved successfully.',
  };
});

app.get<{ Querystring: { from?: string; to?: string } }>(
  '/api/reports/cash-flow',
  async (request, reply) => {
    const now = new Date();
    const from = request.query.from
      ? new Date(request.query.from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = request.query.to ? new Date(request.query.to) : now;
    to.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
      include: {
        safe: { select: { id: true, name: true, currency: true } },
        customer: { select: { id: true, code: true, name: true } },
      },
    });

    const summary = transactions.reduce(
      (acc, tx) => {
        if (tx.type === 'GIRIS') acc.totalIn += tx.amount;
        else acc.totalOut += tx.amount;
        return acc;
      },
      { totalIn: 0, totalOut: 0 }
    );

    if (request.headers.accept?.includes('text/csv')) {
      const header = 'Tarih;Tip;Kasa;Tutar;Açıklama';
      const lines = transactions.map((tx) =>
        [
          tx.createdAt.toISOString(),
          tx.type,
          tx.safe.name,
          tx.amount,
          tx.description.replace(/;/g, ','),
        ].join(';')
      );
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header(
        'Content-Disposition',
        'attachment; filename="kasa-raporu.csv"'
      );
      return `${header}\n${lines.join('\n')}`;
    }

    return {
      success: true,
      data: {
        from,
        to,
        summary: { ...summary, net: summary.totalIn - summary.totalOut },
        transactions,
      },
      message: 'Cash flow report retrieved successfully.',
    };
  }
);

app.get<{ Querystring: { customerId?: string } }>(
  '/api/reports/customer-statement',
  async (request, reply) => {
    const customerId = Number(request.query.customerId);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      return {
        success: false,
        message: 'customerId zorunludur.',
        errors: null,
      };
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        code: true,
        name: true,
        balance: true,
        creditLimit: true,
      },
    });

    if (!customer) {
      return {
        success: false,
        message: 'Müşteri bulunamadı.',
        errors: null,
      };
    }

    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNo: true,
          type: true,
          totalAmountTl: true,
          paymentMethod: true,
          createdAt: true,
        },
      }),
      prisma.transaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        include: {
          safe: { select: { name: true, currency: true } },
        },
      }),
    ]);

    type StatementLine = {
      date: Date;
      kind: 'invoice' | 'payment';
      description: string;
      debit: number;
      credit: number;
    };

    const lines: StatementLine[] = [];

    for (const inv of invoices) {
      const isDebit = inv.type === 'SATIS';
      lines.push({
        date: inv.createdAt,
        kind: 'invoice',
        description: `${inv.invoiceNo} (${inv.type})`,
        debit: isDebit ? inv.totalAmountTl : 0,
        credit: !isDebit ? inv.totalAmountTl : 0,
      });
    }

    for (const pay of payments) {
      lines.push({
        date: pay.createdAt,
        kind: 'payment',
        description: pay.description,
        debit: pay.type === 'CIKIS' ? pay.amount : 0,
        credit: pay.type === 'GIRIS' ? pay.amount : 0,
      });
    }

    lines.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (request.headers.accept?.includes('text/csv')) {
      const header = 'Tarih;Açıklama;Borç;Alacak';
      const csvLines = lines.map((line) =>
        [
          line.date.toISOString(),
          line.description.replace(/;/g, ','),
          line.debit,
          line.credit,
        ].join(';')
      );
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="ekstre-${customer.code}.csv"`
      );
      return `${header}\n${csvLines.join('\n')}`;
    }

    return {
      success: true,
      data: { customer, lines },
      message: 'Customer statement retrieved successfully.',
    };
  }
);

async function start() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`API sunucusu http://localhost:${PORT} adresinde çalışıyor`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
