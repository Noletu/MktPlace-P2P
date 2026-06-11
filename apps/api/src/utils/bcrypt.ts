import bcrypt from 'bcryptjs';

// SER-38: padronizado em cost-12 (antes 10). Iguala o custo do bcrypt real ao
// do hash dummy de timing (cost-12), fechando o leak de timing em logins.
export const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  const isMatch = await bcrypt.compare(password, hashedPassword);
  return isMatch;
};

// SER-38: indica se um hash foi gerado com cost abaixo do padrão atual
// (SALT_ROUNDS) e deve ser re-hasheado de forma transparente no login. O cost
// fica embutido no próprio hash bcrypt, então não há campo extra no schema.
export const needsRehash = (hashedPassword: string): boolean => {
  return bcrypt.getRounds(hashedPassword) < SALT_ROUNDS;
};
