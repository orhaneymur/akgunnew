import PageShell from '../components/PageShell';
import { pageShellConfigs } from '../lib/navigation';

export default function Reports() {
  return <PageShell {...pageShellConfigs.reports} />;
}
