/* Testes de integração com um PostgreSQL REAL (ver README: Testes). Sem as variáveis POSTGRES_*, nenhum roda. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/integracao/**/*.int-spec.ts'],
  testTimeout: 30000
};
