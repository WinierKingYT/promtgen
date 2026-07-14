export const SECRET_PATTERNS = [
    /(key|password|secret|private_key|token|auth_token|passwd|credential|api_key)\s*[:=]\s*['"[a-zA-Z0-9_\-\.]{12,}/i,
    /-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----/i,
    /AIzaSy[A-Za-z0-9_\-]{33}/
];

export function scanForSecrets(content) {
    if (!content) return false;
    for (const regex of SECRET_PATTERNS) {
        if (regex.test(content)) {
            return true;
        }
    }
    return false;
}
