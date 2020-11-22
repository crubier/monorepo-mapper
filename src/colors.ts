type Color = string;

const colors: Color[] = [
	'#FEE2E2',
	'#FFEDD5',
	'#FEF3C7',
	'#FEF9C3',
	'#ECFCCB',
	'#DCFCE7',
	'#D1FAE5',
	'#CCFBF1',
	'#CFFAFE',
	'#E0F2FE',
	'#DBEAFE',
	'#E0E7FF',
	'#EDE9FE',
	'#F3E8FF',
	'#FAE8FF',
	'#FCE7F3',
	'#FFE4E6',
];

export function assignColorsToGroups(
	groups: Map<string, string[]>
): Map<string, Color> {
	const result: Map<string, Color> = new Map();
	const keys = [...groups.keys()].sort();

	keys.forEach((groupName, index) => {
		result.set(groupName, colors[(index * 5) % colors.length]);
	});

	return result;
}
