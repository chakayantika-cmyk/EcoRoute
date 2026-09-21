const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

const regex = /@default\(([A-Z_]+)\)/g;
schema = schema.replace(regex, '@default("$1")');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema defaults updated with quotes.');
