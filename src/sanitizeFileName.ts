var illegalRe = /[\/\?<>\\:\*\|":@\\\/]/g;
var controlRe = /[\x00-\x1f\x80-\x9f]/g;
var reservedRe = /^\.+$/;
var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

export function sanitizeFileName(input: string, replacement: string = '_') {
	const sanitized = input
		.replace(illegalRe, replacement)
		.replace(controlRe, replacement)
		.replace(reservedRe, replacement)
		.replace(windowsReservedRe, replacement);
	return sanitized.substring(0, 255);
}
