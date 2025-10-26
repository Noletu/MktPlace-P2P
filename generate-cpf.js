// Gerador de CPF válido

function generateCPF() {
  // Gera 9 primeiros dígitos aleatórios
  const n1 = Math.floor(Math.random() * 10);
  const n2 = Math.floor(Math.random() * 10);
  const n3 = Math.floor(Math.random() * 10);
  const n4 = Math.floor(Math.random() * 10);
  const n5 = Math.floor(Math.random() * 10);
  const n6 = Math.floor(Math.random() * 10);
  const n7 = Math.floor(Math.random() * 10);
  const n8 = Math.floor(Math.random() * 10);
  const n9 = Math.floor(Math.random() * 10);

  // Calcula primeiro dígito verificador
  let d1 =
    n9 * 2 +
    n8 * 3 +
    n7 * 4 +
    n6 * 5 +
    n5 * 6 +
    n4 * 7 +
    n3 * 8 +
    n2 * 9 +
    n1 * 10;
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;

  // Calcula segundo dígito verificador
  let d2 =
    d1 * 2 +
    n9 * 3 +
    n8 * 4 +
    n7 * 5 +
    n6 * 6 +
    n5 * 7 +
    n4 * 8 +
    n3 * 9 +
    n2 * 10 +
    n1 * 11;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;

  return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
}

// Gerar 3 CPFs válidos
console.log('=== CPFs Válidos ===');
for (let i = 0; i < 3; i++) {
  const cpf = generateCPF();
  console.log(`CPF ${i + 1}: ${cpf}`);
}

// CPFs conhecidos e válidos
console.log('\n=== CPFs Conhecidos e Válidos ===');
const knownValid = [
  '52998224725',
  '41933829030',
  '86880994050',
  '72788740002',
  '59127631702',
];

knownValid.forEach((cpf, i) => {
  console.log(`CPF Conhecido ${i + 1}: ${cpf}`);
});
