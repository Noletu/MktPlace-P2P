import { Suspense } from 'react';
import AppHeader from '@/components/AppHeader';
import ResetPasswordForm from '@/components/forms/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <>
      <AppHeader />
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50 dark:bg-gray-900">
      <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm flex flex-col">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-900 dark:text-white">
          Redefinir Senha
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          Crie uma nova senha para sua conta
        </p>

        <Suspense fallback={
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
    </>
  );
}
