export function getStatusClass(status: string): string {
  switch (status) {
    case 'Taller':      return 'bg-blue-100 text-blue-800';
    case 'Ligero':      return 'bg-purple-100 text-purple-800';
    case 'Instalacion': return 'bg-yellow-100 text-yellow-800';
    case 'Finalizada':  return 'bg-green-100 text-green-800';
    case 'General':     return 'bg-gray-100 text-gray-600';
    default:            return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'Taller':      return 'Taller';
    case 'Ligero':      return 'Ligero';
    case 'Instalacion': return 'Instalación';
    case 'Finalizada':  return 'Finalizada';
    case 'General':     return 'General';
    default:            return status;
  }
}

export function isOrderLocked(status: string): boolean {
  return status === 'Finalizada';
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '00:00:00';
  const hours   = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs    = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
