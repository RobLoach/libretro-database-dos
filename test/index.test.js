const test = require('node:test')
const assert = require('node:assert')
const zlib = require('node:zlib')
const {
	acceptableFile,
	acceptableGame,
	buildDatabase,
	cleanGameName,
	formatDat,
	getMetadata,
	getTags,
	getVersion,
	readZipEntry
} = require('..')

test('cleanGameName', () => {
	assert.strictEqual(cleanGameName('4 to Save Toon Land (1995)(PPPTeam) [Action].zip'), '4 to Save Toon Land')
	assert.strictEqual(cleanGameName('3D Dungeon RPG Maker (Ko) (1996)(MIR Game & Communication) [Role-Playing (RPG)].zip'), '3D Dungeon RPG Maker')
	assert.strictEqual(cleanGameName('587 Squadron (ZZT) [FW] (2021)(PogeSoft) [Action].zip'), '587 Squadron')
	assert.strictEqual(cleanGameName('Pyro ][ v2.2 [SW] (1990)(Michael O\'Brien) [Action].zip'), 'Pyro ][')
	assert.strictEqual(cleanGameName('Hugo 2 (He) (1996)(ITE Media ApS (Interactive Television Entertainment)) [Action].zip'), 'Hugo 2')
	assert.strictEqual(cleanGameName('Pack Regalo Amstrad PC (Es) (1988)(Dinamic Software) [Compilation].img.zip'), 'Pack Regalo Amstrad PC')
	assert.strictEqual(cleanGameName('1939 (demo) (1996)(Strategy First) [Action].zip'), '1939 (Demo)')
	assert.strictEqual(cleanGameName('Lemmings 3D (ECTS Spring 95 Demo Version) (1995)(Psygnosis Limited) [Puzzle].zip'), 'Lemmings 3D (Demo)')
	assert.strictEqual(cleanGameName('1483 Anno Domini r930427 (1993)(CAPS Softwaredesign) [Strategy].zip'), '1483 Anno Domini')
	assert.strictEqual(cleanGameName('Zork- The Great Underground Empire r15 (demo) [DC] (1984)(Infocom, Inc.) [Adventure].zip'), 'Zork: The Great Underground Empire (Demo)')
	assert.strictEqual(cleanGameName('Maniac Mansion- Day of the Tentacle CD (1993)(LucasArts Entertainment Company) [Adventure].zip'), 'Maniac Mansion: Day of the Tentacle CD')
	assert.strictEqual(cleanGameName('Hugo - På Nye Eventyr (Da) (1991)(ITE Media ApS) [Action].zip'), 'Hugo: På Nye Eventyr')
	assert.strictEqual(cleanGameName('\'Nam 1965-1975 (1991)(Domark Software, Inc.) [Simulation].zip'), '\'Nam 1965-1975')
})

test('getMetadata', () => {
	assert.deepStrictEqual(getMetadata('King\'s Quest II- Romancing the Throne v2.2 (AGI 2.917) (1988)(Sierra On-Line, Inc.) [Adventure].zip'), {
		genre: 'Adventure',
		releaseyear: '1988',
		developer: 'Sierra On-Line'
	})
	assert.deepStrictEqual(getMetadata('3D Dungeon RPG Maker (Ko) (1996)(MIR Game & Communication) [Role-Playing (RPG)].zip'), {
		genre: 'Role-playing (RPG)',
		releaseyear: '1996',
		developer: 'MIR Game & Communication'
	})
	assert.deepStrictEqual(getMetadata('Hugo (De) (1995)(ITE Media ApS (Interactive Television Entertainment)) [Racing - Driving, Action].zip'), {
		genre: 'Racing',
		releaseyear: '1995',
		developer: 'ITE Media ApS (Interactive Television Entertainment)'
	})
	assert.deepStrictEqual(getMetadata('Might and Magic III (1991)(New World Computing, Inc.) [Role-Playing (RPG)].zip').developer, 'New World Computing')
	assert.deepStrictEqual(getMetadata('Nobunaga\'s Ambition (1988)(KOEI Co., Ltd.) [Strategy].zip').developer, 'KOEI')
	assert.deepStrictEqual(getMetadata('Dark Sun- Wake of the Ravager (1995)(Mindscape, Inc., Strategic Simulations, Inc.) [Role-Playing (RPG)].zip').developer, 'Mindscape, Strategic Simulations')
	assert.deepStrictEqual(getMetadata('Heroes of Jin Yong (1996)(Tan Ton Nerw Information Co.,Ltd.) [Role-Playing (RPG)].zip').developer, 'Tan Ton Nerw Information')
	assert.deepStrictEqual(getMetadata('Incredible Machine, The (1993)(Incentive Software) [Puzzle].zip').developer, 'Incentive Software')
	assert.deepStrictEqual(getMetadata('Bomberman (1990)(Hudson Soft Company, Ltd.) [Action].zip').developer, 'Hudson Soft')
	assert.deepStrictEqual(getMetadata('Das Schwarze Auge- Sternenschweif (De) (1997)(TREND Redaktions- und Verlagsgesellschaft) [Role-Playing (RPG)].zip').developer, 'TREND Redaktions- und Verlagsgesellschaft')
	assert.deepStrictEqual(getMetadata('Personal Copam (He) (19xx)(Micro-Ware) [Cards].zip'), {
		genre: 'Card',
		developer: 'Micro-Ware'
	})
	assert.deepStrictEqual(getMetadata('Unknown Game [SW]'), {})
})

test('getTags', () => {
	assert.deepStrictEqual(getTags('Pyro ][ v2.2 [SW] (1990)(Michael O\'Brien) [Action, Strategy][!].zip'), ['SW', 'Action', 'Strategy', '!'])
})

test('acceptableGame', () => {
	assert.ok(acceptableGame('Awesome Earl in SkateRock [h1] (1988)(ShareData, Inc.) [Action, Sports].zip'))
	assert.ok(acceptableGame('Moon Bugs [DC][a3] (1983)(Windmill Software Inc.) [Action].zip'))
	assert.ok(!acceptableGame('Pipe Dream (1989)(LucasArts) [Codes].zip'))
	assert.ok(!acceptableGame('Stationfall (1987)(Infocom, Inc.) [Map, InvisiClues, Walkthrough].zip'))
	assert.ok(!acceptableGame('Cool Spot (1994)(Virgin Interactive Entertainment (Europe) Ltd.) [Trainer #2].zip'))
	assert.ok(!acceptableGame('Kult (En)(De)(Fr) [b1] (1989)(Infogrames Europe SA) [IMA][360k][cp].zip'))
	assert.ok(!acceptableGame('F-19 Stealth Fighter - F-19 Roster Editor (1989) (Mark Bowman) [Simulation, Utility].zip'))
	assert.ok(!acceptableGame('Links v1.52 (Installer) (1991)(Access Software, Inc.) [Simulation, Sports, Addon].zip'))
})

test('acceptableFile', () => {
	assert.strictEqual(acceptableFile({ name: 'KEEN1.EXE' }), 'KEEN1.EXE')
	assert.strictEqual(acceptableFile({ name: 'cga\\BOND.EXE' }), 'BOND.EXE')
	assert.strictEqual(acceptableFile({ name: 'DISK1.IMA' }), 'DISK1.IMA')
	assert.strictEqual(acceptableFile({ name: 'INSTALL.IMG' }), false)
	assert.strictEqual(acceptableFile({ name: 'README.TXT' }), false)
	assert.strictEqual(acceptableFile({ name: 'SETUP.EXE' }), false)
	assert.strictEqual(acceptableFile({ name: 'DOS4GW.EXE' }), false)
})

test('getVersion', () => {
	assert.strictEqual(getVersion('Sunday, October 25, 2026@00:00'), '2026.10.25')
	assert.strictEqual(getVersion('Monday, March 2, 2026@00:00'), '2026.3.2')
	assert.throws(() => getVersion(undefined))
})

test('buildDatabase', () => {
	const database = buildDatabase([
		{
			name: 'Bingo (2002)(Phillip Gervais) [Adventure].zip',
			entries: [
				{ name: 'BINGO.BAS', size: '100', crc: '11111111' },
				{ name: 'QBASIC.EXE', size: '194309', crc: '3152911c' }
			]
		},
		{
			name: 'Gorillas (1991)(Microsoft) [Action].zip',
			entries: [
				{ name: 'GORILLA.BAT', size: '20', crc: '22222222' },
				{ name: 'QBASIC.EXE', size: '194309', crc: '3152911c' }
			]
		},
		{
			name: 'Dungeons of Noudar [FW] (2017)(Daniel Monteiro) [Adventure].zip',
			entries: [
				{ name: 'cwsdpmi.exe', size: '20473', crc: '80fa6999' },
				{ name: 'NOUDAR.exe', size: '886784', crc: 'a76b6f2d' }
			]
		},
		{
			name: 'Dungeons of Noudar [FW] (2017)(Daniel Monteiro) [Adventure][a1].zip',
			entries: [
				{ name: 'NOUDAR.exe', size: '886784', crc: 'a76b6f2d' }
			]
		},
		{
			name: 'Dungeons of Noudar 3D [FW] (2018)(Daniel Monteiro) [Adventure].zip',
			entries: [
				{ name: 'cwsdpmi.exe', size: '20473', crc: '80fa6999' },
				{ name: 'noudar.exe', size: '833536', crc: 'ceb3bb42' }
			]
		},
		{
			name: 'Pipe Dream (1989)(LucasArts) [Codes].zip',
			entries: [{ name: 'TG.COM', size: '5000', crc: '33333333' }]
		},
		{
			name: 'Bond (1989)(Domark Limited) [Action].zip',
			entries: [
				{ name: 'BOND.IMA', size: '368640', crc: '44444444' },
				{ name: 'QBASIC.EXE', size: '194309', crc: '3152911c' },
				{ name: 'cga\\BOND.EXE', size: '50000', crc: '55555555' }
			]
		},
		{
			name: 'Kult (1989)(Infogrames Europe SA) [Adventure].zip',
			entries: [{ name: 'KULT.EXE', size: '90000', crc: '88888888' }]
		},
		{
			name: 'Kult (En)(De)(Fr) (1989)(Infogrames Europe SA) [IMA][360k].zip',
			entries: [
				{ name: 'KULT_A.IMA', size: '368640', crc: '66666666' },
				{ name: 'KULT_B.IMA', size: '368640', crc: '77777777' }
			]
		},
		{
			name: '大富翁 (Zh) (1989)(SoftStar Entertainment) [Strategy].zip',
			entries: [{ name: 'DFW.EXE', size: '151206', crc: '9014D48F' }]
		}
	], [
		{ name: 'Richman', filename: 'DFW.EXE', size: 151206, crc: '9014d48f', meta: { releaseyear: '1989' } }
	])

	assert.deepStrictEqual(database.map(game => [game.name, game.filename, game.crc]), [
		['Bond', 'BOND.EXE', '55555555'],
		['Dungeons of Noudar', 'NOUDAR.exe', 'A76B6F2D'],
		['Dungeons of Noudar 3D', 'noudar.exe', 'CEB3BB42'],
		['Gorillas', 'GORILLA.BAT', '22222222'],
		['Kult', 'KULT_A.IMA', '66666666'],
		['Kult', 'KULT.EXE', '88888888'],
		['Richman', 'DFW.EXE', '9014D48F']
	])
	assert.deepStrictEqual(database.find(game => game.filename === 'KULT_A.IMA').meta, {
		genre: 'Adventure',
		releaseyear: '1989',
		developer: 'Infogrames Europe SA'
	})
})

test('formatDat', () => {
	const output = formatDat([{
		name: 'Gorillas',
		filename: 'GORILLA.BAT',
		size: 20,
		crc: '22222222',
		meta: { genre: 'Action', releaseyear: '1991', developer: 'Microsoft' }
	}], '2026.10.25')
	assert.ok(output.startsWith('clrmamepro (\n\tname "DOS"\n\tdescription "DOS"\n\tversion "2026.10.25"\n\textensions "bat|com|exe|ima|img"\n'))
	assert.ok(output.endsWith(`
game (
	name "Gorillas"
	genre "Action"
	releaseyear "1991"
	developer "Microsoft"
	rom ( name "GORILLA.BAT" size 20 crc 22222222 )
)
`))
})

/**
 * Builds a .zip archive containing the given files.
 */
function makeZip(files, method = 8) {
	const locals = []
	const centrals = []
	let offset = 0
	for (const [name, content] of Object.entries(files)) {
		const data = Buffer.from(content)
		const compressed = method === 8 ? zlib.deflateRawSync(data) : data
		const nameBuffer = Buffer.from(name)
		const local = Buffer.alloc(30)
		local.writeUInt32LE(0x04034b50, 0)
		local.writeUInt16LE(method, 8)
		local.writeUInt32LE(zlib.crc32(data), 14)
		local.writeUInt32LE(compressed.length, 18)
		local.writeUInt32LE(data.length, 22)
		local.writeUInt16LE(nameBuffer.length, 26)
		const central = Buffer.alloc(46)
		central.writeUInt32LE(0x02014b50, 0)
		central.writeUInt16LE(method, 10)
		central.writeUInt32LE(zlib.crc32(data), 16)
		central.writeUInt32LE(compressed.length, 20)
		central.writeUInt32LE(data.length, 24)
		central.writeUInt16LE(nameBuffer.length, 28)
		central.writeUInt32LE(offset, 42)
		locals.push(local, nameBuffer, compressed)
		centrals.push(central, nameBuffer)
		offset += local.length + nameBuffer.length + compressed.length
	}
	const centralDirectory = Buffer.concat(centrals)
	const end = Buffer.alloc(22)
	end.writeUInt32LE(0x06054b50, 0)
	end.writeUInt16LE(Object.keys(files).length, 8)
	end.writeUInt16LE(Object.keys(files).length, 10)
	end.writeUInt32LE(centralDirectory.length, 12)
	end.writeUInt32LE(offset, 16)
	return Buffer.concat([...locals, centralDirectory, end])
}

test('readZipEntry', () => {
	const zip = makeZip({ '../tdc_daily.dat': 'evil', 'tdc_daily.dat': 'DOSCenter (' })
	assert.strictEqual(readZipEntry(zip, 'tdc_daily.dat').toString(), 'DOSCenter (')
	assert.strictEqual(readZipEntry(makeZip({ 'tdc_daily.dat': 'stored' }, 0), 'tdc_daily.dat').toString(), 'stored')
	assert.throws(() => readZipEntry(makeZip({ 'other.dat': 'DOSCenter (' }), 'tdc_daily.dat'), /not found/)
	assert.throws(() => readZipEntry(Buffer.from('not a zip file at all'), 'tdc_daily.dat'), /Not a \.zip file/)

	// Corrupt the stored data so that it no longer matches its CRC.
	const corrupt = makeZip({ 'tdc_daily.dat': 'DOSCenter (' }, 0)
	corrupt[30 + 'tdc_daily.dat'.length] ^= 0xff
	assert.throws(() => readZipEntry(corrupt, 'tdc_daily.dat'), /CRC/)
})
