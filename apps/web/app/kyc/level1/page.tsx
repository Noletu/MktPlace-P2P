import KYCLevel1Form from '@/components/forms/KYCLevel1Form';
import ThemeToggle from '@/components/ThemeToggle';

export default function KYCLevel1Page() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto mb-4 flex justify-end">
        <ThemeToggle />
      </div>
      <KYCLevel1Form />
    </div>
  );
}
