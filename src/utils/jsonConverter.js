const xml2js = require('xml2js');
const yaml = require('js-yaml');

class JsonConverter {
    static async xmlToJson(xml) {
        return new Promise((resolve, reject) => {
            xml2js.parseString(xml, (err, result) => {
                if (err) reject(err);
                resolve(JSON.stringify(result, null, 2));
            });
        });
    }

    static async jsonToXml(json) {
        try {
            const obj = typeof json === 'string' ? JSON.parse(json) : json;
            
            // Wrap the JSON in a root element if it's an array or primitive
            const wrappedObj = Array.isArray(obj) || typeof obj !== 'object' 
                ? { root: obj } 
                : obj;

            // Configure XML builder
            const builder = new xml2js.Builder({
                rootName: 'root',
                headless: true,
                renderOpts: {
                    pretty: true,
                    indent: '  ',
                    newline: '\n'
                },
                xmldec: {
                    version: '1.0',
                    encoding: 'UTF-8'
                }
            });

            return builder.buildObject(wrappedObj);
        } catch (e) {
            throw new Error(`XML conversion failed: ${e.message}`);
        }
    }

    static yamlToJson(yaml) {
        const obj = yaml.load(yaml);
        return JSON.stringify(obj, null, 2);
    }

    static jsonToTypeScript(json) {
        const obj = typeof json === 'string' ? JSON.parse(json) : json;
        return this.generateTypeScript(obj, 'RootType');
    }

    static generateTypeScript(obj, typeName) {
        if (Array.isArray(obj)) {
            const sample = obj[0];
            if (sample && typeof sample === 'object') {
                return `${this.generateTypeScript(sample, typeName)}[]`;
            }
            return `${typeof sample || 'any'}[]`;
        }

        if (typeof obj === 'object' && obj !== null) {
            const properties = Object.entries(obj).map(([key, value]) => {
                let propertyType;
                if (value === null) {
                    propertyType = 'null';
                } else if (Array.isArray(value)) {
                    propertyType = this.generateTypeScript(value, `${typeName}${key.charAt(0).toUpperCase() + key.slice(1)}`);
                } else if (typeof value === 'object') {
                    propertyType = this.generateTypeScript(value, `${typeName}${key.charAt(0).toUpperCase() + key.slice(1)}`);
                } else {
                    propertyType = typeof value;
                }
                return `    ${key}: ${propertyType};`;
            });

            return `interface ${typeName} {\n${properties.join('\n')}\n}`;
        }

        return typeof obj;
    }

    static urlParamsToJson(params) {
        const urlParams = new URLSearchParams(params);
        const result = {};
        for (const [key, value] of urlParams) {
            result[key] = value;
        }
        return JSON.stringify(result, null, 2);
    }
}

module.exports = JsonConverter; 