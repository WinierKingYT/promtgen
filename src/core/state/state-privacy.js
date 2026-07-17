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
        if (level === SENSITIVITY_LEVELS.PUBLIC) return this._redactDeep(state, true);
        if (level === SENSITIVITY_LEVELS.INTERNAL) return this._redactDeep(state, false);
        return this._redactDeep(state, false);
    }

    _redactDeep(obj, strict, path = '') {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map((item, i) => this._redactDeep(item, strict, `${path}/${i}`));

        const result = {};
        for (const [key, val] of Object.entries(obj)) {
            const currentPath = `${path}/${key}`;

            if (this._isSensitive(key, currentPath, strict)) {
                result[key] = this._redactValue(val);
            } else if (val && typeof val === 'object') {
                result[key] = this._redactDeep(val, strict, currentPath);
            } else {
                result[key] = val;
            }
        }
        return result;
    }

    _isSensitive(key, path, strict) {
        if (this.sensitivePaths.some(sp => path.startsWith(sp) || path === sp)) return true;
        if (this.sensitivePatterns.some(p => p.test(key))) return true;
        if (strict && (key.toLowerCase().includes('name') || key.toLowerCase().includes('contact'))) return true;
        return false;
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
