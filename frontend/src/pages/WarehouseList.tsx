import PageShell from '../components/PageShell';
import { pageShellConfigs } from '../lib/navigation';

export default function WarehouseList() {
  return <PageShell {...pageShellConfigs['warehouse-list']} />;
}
