"use strict";
/**
 * Database Query Wrapper for PostgreSQL
 * Provides a consistent interface between MySQL and PostgreSQL
 * Converts PostgreSQL QueryResult to MySQL-like [rows, fields] format
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbQuery = dbQuery;
exports.dbQuerySingle = dbQuerySingle;
exports.dbExecute = dbExecute;
const db_config_1 = require("../config/db.config");
function dbQuery(sql_1) {
    return __awaiter(this, arguments, void 0, function* (sql, values = []) {
        try {
            // Convert MySQL placeholder ? to PostgreSQL placeholder $1, $2, etc.
            let pgSql = sql;
            let paramIndex = 1;
            pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
            const result = yield db_config_1.pool.query(pgSql, values);
            // Return in MySQL format: [rows, fields]
            return [result.rows, result.fields];
        }
        catch (error) {
            throw error;
        }
    });
}
function dbQuerySingle(sql_1) {
    return __awaiter(this, arguments, void 0, function* (sql, values = []) {
        try {
            const [rows] = yield dbQuery(sql, values);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            throw error;
        }
    });
}
function dbExecute(sql_1) {
    return __awaiter(this, arguments, void 0, function* (sql, values = []) {
        try {
            // Convert MySQL placeholder ? to PostgreSQL placeholder $1, $2, etc.
            let pgSql = sql;
            let paramIndex = 1;
            pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
            const result = yield db_config_1.pool.query(pgSql, values);
            return { affectedRows: result.rowCount || 0 };
        }
        catch (error) {
            throw error;
        }
    });
}
