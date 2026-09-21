const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const enums = [
  'UserRole',
  'AccountStatus',
  'TaskStatus',
  'MeasurementType',
  'ProviderStatus',
  'ModelStatus'
];

enums.forEach(e => {
  schema = schema.replace(new RegExp(`enum ${e} {[^}]*}\\n*`, 'g'), '');
  schema = schema.replace(new RegExp(`${e}(\\??)`, 'g'), 'String$1');
});

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated for SQLite.');
