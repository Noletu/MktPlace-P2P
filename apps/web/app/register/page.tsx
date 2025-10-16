import RegisterForm from '@/components/forms/RegisterForm';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50 dark:bg-gray-900">
      <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm flex flex-col">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-900 dark:text-white">
          Criar Conta
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          Registre-se no Mktplace da Liberdade
        </p>

        <RegisterForm />
      </div>
    </main>
  );
}
