class JsonFormatter {
    static format(json) {
        try {
            const obj = typeof json === 'string' ? JSON.parse(json) : json;
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            throw new Error('Invalid JSON');
        }
    }

    static compress(json) {
        try {
            const obj = typeof json === 'string' ? JSON.parse(json) : json;
            return JSON.stringify(obj);
        } catch (e) {
            throw new Error('Invalid JSON');
        }
    }

    static escape(json) {
        const obj = typeof json === 'string' ? JSON.parse(json) : json;
        return JSON.stringify(JSON.stringify(obj));
    }

    static unescape(json) {
        try {
            return JSON.parse(JSON.parse(json));
        } catch (e) {
            throw new Error('Invalid escaped JSON');
        }
    }

    static removeComments(jsonString) {
        return jsonString
            .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')
            .replace(/^\s*[\r\n]/gm, '');
    }
}

module.exports = JsonFormatter; 