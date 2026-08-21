import * as dotenv from 'dotenv';
dotenv.config();

let pk = process.env.FIREBASE_PRIVATE_KEY || '';
// Clean it up
if (!pk.includes('-----BEGIN PRIVATE KEY-----')) {
    // If it starts with an 'n' before 'MII', strip the 'n'
    if (pk.startsWith('nMII')) {
        pk = pk.substring(1);
    }
    pk = '-----BEGIN PRIVATE KEY-----\n' + pk;
}
pk = pk.replace(/\\n/g, '\n');

console.log(pk.substring(0, 50));
console.log(pk.substring(pk.length - 50));
