const SENSITIVE_PATTERNS = [
    /password/i, /secret/i, /token/i, /api[_-]?key/i,
    /private[_-]?key/i, /credential/i, /auth[_-]?token/i,
    /access[_-]?token/i, /refresh[_-]?token/i, /jwt/i,
    /ssn/i, /credit[_-]?card/i, /phone/i, /email/i
];

const SENSITIVE_PATHS = [
    '/secrets', '/credentials', '/tokens', '/keys',
    '/identity/email', '/identity/phone', '/identity/address'
];

export const SENSITIVITY_LEVELS = {
    PUBLIC: 'public',
    INTERNAL: 'internal',
    CONFIDENTIAL: 'confidential',
    RESTRICTED: 'restricted',
    CRITICAL: 'critical'
};

export class StatePrivacy {
    constructor(rules = {}) {
        this.sensitivePatterns = rules.sensitivePatterns || SENSITIVE_PATTERNS;
        this.sensitivePaths = rules.sensitivePaths || SENSITIVE_PATHS;
    }

    redact(state, level = SENSITIVITY_LEVELS.INTERNAL) {
        if (!state || typeof state !== 'object') return state;
        return this._redactDeep(state, level);
    }

    _redactDeep(obj, level, path = '') {
        if (!obj || typeof obj !== 'object') {
            if (typeof obj === 'string') {
                if (level === SENSITIVITY_LEVELS.PUBLIC || level === SENSITIVITY_LEVELS.INTERNAL) {
                    return this._maskContent(obj, true, true, true);
                } else if (level === SENSITIVITY_LEVELS.CONFIDENTIAL) {
                    return this._maskContent(obj, false, false, true);
                }
            }
            return obj;
        }
        if (Array.isArray(obj)) return obj.map((item, i) => this._redactDeep(item, level, `${path}/${i}`));

        const result = {};
        for (const [key, val] of Object.entries(obj)) {
            const currentPath = `${path}/${key}`;

            if (this._isSensitive(key, currentPath, level)) {
                result[key] = this._redactValue(val);
            } else if (val && typeof val === 'object') {
                result[key] = this._redactDeep(val, level, currentPath);
            } else if (typeof val === 'string') {
                if (level === SENSITIVITY_LEVELS.PUBLIC || level === SENSITIVITY_LEVELS.INTERNAL) {
                    result[key] = this._maskContent(val, true, true, true);
                } else if (level === SENSITIVITY_LEVELS.CONFIDENTIAL) {
                    result[key] = this._maskContent(val, false, false, true);
                } else {
                    result[key] = val;
                }
            } else {
                result[key] = val;
            }
        }
        return result;
    }

    _isSensitive(key, path, level) {
        const alwaysRedactedPaths = ['/secrets', '/credentials', '/tokens', '/keys'];
        if (alwaysRedactedPaths.some(sp => path.startsWith(sp) || path === sp)) return true;

        const alwaysRedactedKeys = [/password/i, /private[_-]?key/i, /credential/i];
        if (alwaysRedactedKeys.some(p => p.test(key))) return true;

        if (level === SENSITIVITY_LEVELS.CRITICAL) {
            return false;
        }

        const restrictedKeys = [/secret/i, /token/i, /api[_-]?key/i, /auth[_-]?token/i, /access[_-]?token/i, /refresh[_-]?token/i, /jwt/i];
        if (restrictedKeys.some(p => p.test(key))) return true;
        if (level === SENSITIVITY_LEVELS.RESTRICTED) {
            return false;
        }

        const confidentialKeys = [/ssn/i, /credit[_-]?card/i, /phone/i, /email/i];
        if (confidentialKeys.some(p => p.test(key))) return true;
        if (level === SENSITIVITY_LEVELS.CONFIDENTIAL) {
            return false;
        }

        if (level === SENSITIVITY_LEVELS.PUBLIC) {
            if (key.toLowerCase().includes('name') || key.toLowerCase().includes('contact')) return true;
        }

        return false;
    }

    _maskContent(val, maskEmail, maskPhone, maskKeys) {
        if (typeof val !== 'string') return val;
        let masked = val;
        if (maskEmail) {
            masked = masked.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***');
        }
        if (maskPhone) {
            masked = masked.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '***-***-****');
        }
        if (maskKeys) {
            masked = masked.replace(/(?:key|secret|token|passwd|password)[_-]?\w{10,}/gi, '[MASKED_KEY]');
        }
        return masked;
    }

    _redactValue(val) {
        if (typeof val === 'string') {
            if (val.length <= 4) return '****';
            return val[0] + '****' + val[val.length - 1];
        }
        if (typeof val === 'object') return '[REDACTED]';
        return '****';
    }

    getSafeExport(state, level = SENSITIVITY_LEVELS.PUBLIC) {
        const redacted = this.redact(state, level);
        return {
            exportedAt: new Date().toISOString(),
            sensitivityLevel: level,
            state: redacted,
            redactionRules: {
                patterns: this.sensitivePatterns.map(p => p.source),
                paths: this.sensitivePaths
            }
        };
    }

    addSensitivePath(path) {
        if (!this.sensitivePaths.includes(path)) this.sensitivePaths.push(path);
    }

    addSensitivePattern(pattern) {
        if (typeof pattern === 'string') pattern = new RegExp(pattern, 'i');
        if (!this.sensitivePatterns.some(p => p.source === pattern.source)) {
            this.sensitivePatterns.push(pattern);
        }
    }
}
