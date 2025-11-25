"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
function generateHash() {
    return __awaiter(this, void 0, void 0, function* () {
        const passwords = [
            { label: 'Admin', email: 'admin@activecore.com', password: 'Admin@2024!Secure' },
            { label: 'Member', email: 'member@activecore.com', password: 'Member@2024!Secure' }
        ];
        console.log('Generating secure password hashes...\n');
        console.log('='.repeat(60));
        for (const user of passwords) {
            const hash = yield bcryptjs_1.default.hash(user.password, 12);
            console.log(`\n${user.label} Account:`);
            console.log(`Email: ${user.email}`);
            console.log(`Password: ${user.password}`);
            console.log(`Hash: ${hash}`);
            console.log('\nSQL UPDATE command:');
            console.log(`UPDATE users SET password = '${hash}' WHERE email = '${user.email}';`);
            console.log('\n' + '-'.repeat(60));
        }
        // Test the hashes
        console.log('\n=== TESTING HASHES ===\n');
        for (const user of passwords) {
            const hash = yield bcryptjs_1.default.hash(user.password, 12);
            const isValid = yield bcryptjs_1.default.compare(user.password, hash);
            console.log(`${user.label}: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
        }
        console.log('\n' + '='.repeat(60));
        console.log('\n📋 INSTRUCTIONS:');
        console.log('1. Copy the SQL UPDATE commands above');
        console.log('2. Run them in phpMyAdmin SQL tab');
        console.log('3. Restart the backend server');
        console.log('4. Login with the new passwords shown above\n');
    });
}
generateHash();
