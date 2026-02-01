import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeRegExp } from './html';

describe('escapeHtml', () => {
    describe('basic functionality', () => {
        it('should escape ampersand & to &amp;', () => {
            expect(escapeHtml('Hello & World')).toBe('Hello &amp; World');
        });

        it('should escape less than < to &lt;', () => {
            expect(escapeHtml('1 < 2')).toBe('1 &lt; 2');
        });

        it('should escape greater than > to &gt;', () => {
            expect(escapeHtml('2 > 1')).toBe('2 &gt; 1');
        });

        it('should escape double quote " to &quot;', () => {
            expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
        });

        it('should escape single quote \' to &#039;', () => {
            expect(escapeHtml('It\'s great')).toBe('It&#039;s great');
        });
    });

    describe('security - XSS prevention', () => {
        it('should escape all special characters in sequence', () => {
            expect(escapeHtml('<>&\'"')).toBe('&lt;&gt;&amp;&#039;&quot;');
        });

        it('should prevent script tag injection', () => {
            const input = '<script>alert(\'xss\')</script>';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;script&gt;');
            expect(result).toContain('&lt;/script&gt;');
            expect(result).not.toContain('<script>');
        });

        it('should prevent img onerror XSS', () => {
            const input = '<img src=x onerror="alert(1)">';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;img');
            expect(result).not.toContain('<img');
        });

        it('should prevent iframe tag injection', () => {
            const input = '<iframe src=\'evil.com\'></iframe>';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;iframe');
            expect(result).not.toContain('<iframe>');
        });

        it('should escape multiple consecutive ampersands', () => {
            expect(escapeHtml('A && B && C')).toBe('A &amp;&amp; B &amp;&amp; C');
        });

        it('should handle mixed case script tags', () => {
            const input = '<Script>alert(\'xss\')</SCRIPT>';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;Script&gt;');
            expect(result).toContain('&lt;/SCRIPT&gt;');
            expect(result).not.toContain('<Script>');
        });

        it('should prevent HTML entity encoding attacks', () => {
            const input = '&#x3C;script&#x3E;alert(\'xss\')&#x3C;/script&#x3E;';
            const result = escapeHtml(input);
            // The ampersands should be escaped
            expect(result).toContain('&amp;#x3C;');
        });

        it('should prevent event handler injection', () => {
            const input = '<div onclick="alert(1)" onload="evil()">';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;div');
            expect(result).not.toContain('<div');
        });
    });

    describe('edge cases', () => {
        it('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('should handle string with only special characters', () => {
            expect(escapeHtml('<>"\'&')).toBe('&lt;&gt;&quot;&#039;&amp;');
        });

        it('should preserve safe characters', () => {
            const input = 'Hello World 123 !@#$%()*+-./:;=?[_]^{|}~';
            expect(escapeHtml(input)).toBe(input);
        });

        it('should handle Unicode characters correctly', () => {
            expect(escapeHtml('Hello 世界 🎉')).toBe('Hello 世界 🎉');
        });

        it('should escape special characters in the middle of string', () => {
            expect(escapeHtml('Hello <world> test')).toBe('Hello &lt;world&gt; test');
        });

        it('should handle already escaped content (double escape)', () => {
            // Note: This will double-escape &amp; to &amp;amp;
            const input = '&lt;script&gt;';
            expect(escapeHtml(input)).toBe('&amp;lt;script&amp;gt;');
        });
    });

    describe('combinations', () => {
        it('should escape complete HTML tags', () => {
            const input = '<div class=\'test\'>Content</div>';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;div');
            expect(result).toContain('&lt;/div&gt;');
        });

        it('should escape HTML attributes with quotes', () => {
            const input = '<a href="http://example.com" title=\'test\'>Link</a>';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;a');
            expect(result).toContain('&quot;http://example.com&quot;');
            expect(result).toContain('&#039;test&#039;');
        });

        it('should escape HTML comments', () => {
            const input = '<!-- comment -->';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;!-- comment --&gt;');
        });

        it('should escape all special characters in complex string', () => {
            const input = '<div data-value="1 & 2">Test < > " \' &</div>';
            const result = escapeHtml(input);
            expect(result).toContain('&lt;div');
            expect(result).toContain('&quot;1 &amp; 2&quot;');
            expect(result).toContain('&lt; &gt; &quot; &#039; &amp;');
        });
    });
});

describe('escapeRegExp', () => {
    describe('basic functionality', () => {
        it('should escape asterisk *', () => {
            expect(escapeRegExp('test*file')).toBe('test\\*file');
        });

        it('should escape plus +', () => {
            expect(escapeRegExp('1+1')).toBe('1\\+1');
        });

        it('should escape question mark ?', () => {
            expect(escapeRegExp('file?.txt')).toBe('file\\?\\.txt');
        });

        it('should escape caret ^', () => {
            expect(escapeRegExp('^start')).toBe('\\^start');
        });

        it('should escape dollar sign $', () => {
            expect(escapeRegExp('end$')).toBe('end\\$');
        });

        it('should escape dot .', () => {
            expect(escapeRegExp('example.com')).toBe('example\\.com');
        });

        it('should escape pipe |', () => {
            expect(escapeRegExp('a|b')).toBe('a\\|b');
        });

        it('should escape parentheses ()', () => {
            expect(escapeRegExp('(group)')).toBe('\\(group\\)');
        });
    });

    describe('complex patterns', () => {
        it('should escape consecutive special characters', () => {
            expect(escapeRegExp('a*b+c?d^e$f.g|h(i)')).toBe(
                'a\\*b\\+c\\?d\\^e\\$f\\.g\\|h\\(i\\)'
            );
        });

        it('should escape square brackets []', () => {
            expect(escapeRegExp('[a-z]')).toBe('\\[a-z\\]');
        });

        it('should escape curly braces {}', () => {
            expect(escapeRegExp('{2,5}')).toBe('\\{2,5\\}');
        });

        it('should escape backslash \\', () => {
            expect(escapeRegExp('a\\b')).toBe('a\\\\b');
        });

        it('should escape regex character class', () => {
            expect(escapeRegExp('\\d+')).toBe('\\\\d\\+');
        });

        it('should handle mixed special and safe characters', () => {
            expect(escapeRegExp('test-file_123')).toBe('test-file_123');
        });
    });

    describe('edge cases', () => {
        it('should handle empty string', () => {
            expect(escapeRegExp('')).toBe('');
        });

        it('should handle string with only special characters', () => {
            expect(escapeRegExp('.+?^${}()|[]\\')).toBe(
                '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\'
            );
        });

        it('should preserve normal characters', () => {
            expect(escapeRegExp('abcdefghijklmnopqrstuvwxyz')).toBe(
                'abcdefghijklmnopqrstuvwxyz'
            );
        });

        it('should escape all meta characters in complete pattern', () => {
            const input = 'https://example.com/path?query=value&sort=asc';
            const result = escapeRegExp(input);
            // ? and . should be escaped; : / & = are not regex meta characters
            expect(result).toContain('example\\.com');
            expect(result).toContain('\\?');
        });
    });

    describe('practical use cases', () => {
        it('should escape user input for regex construction', () => {
            const userInput = 'file*.txt';
            const regex = new RegExp(`^${escapeRegExp(userInput)}$`);
            expect(regex.test('file*.txt')).toBe(true);
            expect(regex.test('fileXtxt')).toBe(false);
        });

        it('should handle file extension pattern', () => {
            const ext = '.txt';
            const result = escapeRegExp(ext);
            expect(result).toBe('\\.txt');
        });

        it('should handle URL pattern matching', () => {
            const url = 'https://example.com';
            const result = escapeRegExp(url);
            expect(result).toContain('example\\.com');
            expect(result).toContain('https:');
        });
    });
});
