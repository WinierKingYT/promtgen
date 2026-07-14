export const FILE_POLICY = {
    MAX_SIZE_BYTES: 1024 * 1024, // 1MB
    ALLOWED_EXTENSIONS: [
        'json', 'txt', 'js', 'ts', 'md', 'cs', 'xml', 'html', 'css', 
        'yml', 'yaml', 'py', 'java', 'go', 'sh', 'bat', 'cpp', 'h'
    ]
};

export function validateFileMetadata(name, size) {
    // Check size
    if (size > FILE_POLICY.MAX_SIZE_BYTES) {
        return {
            valid: false,
            error: 'Dosya boyutu çok büyük! En fazla 1MB büyüklüğünde dosyalar yüklenebilir.'
        };
    }

    // Check extension
    const ext = name.split('.').pop().toLowerCase();
    if (!FILE_POLICY.ALLOWED_EXTENSIONS.includes(ext)) {
        return {
            valid: false,
            error: 'Yalnızca izin verilen kod ve metin tabanlı belgelere izin verilir!'
        };
    }

    return { valid: true };
}
