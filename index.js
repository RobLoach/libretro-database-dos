const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const datfile = require('robloach-datfile')
const acceptableExtensions = require('./lib/acceptableExtensions.json')
const diskImageExtensions = require('./lib/diskImageExtensions.json')
const rejectNames = require('./lib/rejectNames.json')
const rejectGames = require('./lib/rejectGames.json')
const rejectTags = require('./lib/rejectTags.json').map(pattern => new RegExp(pattern, 'i'))
const genres = require('./lib/genres.json')
const developers = require('./lib/developers.json')
const additions = require('./lib/additions.json')
const pkg = require('./package.json')

// The TOSEC date and publisher, such as "(1990)(Sierra On-Line, Inc.)".
const releasePattern = /\((\d{4}|\d{3}x|\d{2}xx)(?:-\d\d){0,2}\)\s*\(((?:[^()]|\([^()]*\))*)\)/

// Company suffixes, like the ", Inc." in "Electronic Arts, Inc." or the " Co., Ltd." in "KOEI Co., Ltd.".
const companySuffix = /,?\s+(?:Co\.,?\s*|Pty\.?\s+)?(?:Inc|Ltd)\.?(?=,|$)/gi

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const tdcUrl = 'http://www.totaldoscollection.org/nugnugnug/tdc_daily.zip'
const tdcFile = 'tdc_daily.dat'

/**
 * Downloads the TDC .dat file, unless the one on disk is already the latest.
 */
async function downloadFile() {
	const headers = {}
	if (fs.existsSync(tdcFile)) {
		headers['If-Modified-Since'] = fs.statSync(tdcFile).mtime.toUTCString()
	}

	let response
	try {
		response = await fetch(tdcUrl, { headers })
	} catch (err) {
		if (!headers['If-Modified-Since']) {
			throw err
		}
		console.warn(`Unable to check for a newer ${tdcFile}, so using the existing one: ${err.message}`)
		return
	}
	if (response.status === 304) {
		return
	}
	if (!response.ok) {
		throw new Error(`Unable to download ${tdcUrl}: HTTP ${response.status}`)
	}

	// The site doesn't support HTTPS, so only extract the expected file, and check that it is a DOSCenter .dat.
	const data = readZipEntry(Buffer.from(await response.arrayBuffer()), tdcFile)
	if (!data.toString('utf8', 0, 16).replace(/^\uFEFF/, '').startsWith('DOSCenter')) {
		throw new Error(`The ${tdcFile} in ${tdcUrl} is not a DOSCenter .dat file`)
	}

	// Write to a temporary file first, so that an interrupted download doesn't leave a partial file.
	fs.writeFileSync('tdc_daily.tmp.dat', data)
	fs.renameSync('tdc_daily.tmp.dat', tdcFile)
	const lastModified = response.headers.get('Last-Modified')
	if (lastModified) {
		fs.utimesSync(tdcFile, new Date(lastModified), new Date(lastModified))
	}
}

/**
 * Reads the file with the given name out of a .zip archive.
 */
function readZipEntry(zip, name) {
	// Find the end of central directory record, which may be followed by a comment.
	let end = zip.length - 22
	while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) {
		end--
	}
	if (end < 0) {
		throw new Error('Not a .zip file')
	}

	let offset = zip.readUInt32LE(end + 16)
	for (let i = zip.readUInt16LE(end + 10); i > 0; i--) {
		if (zip.readUInt32LE(offset) !== 0x02014b50) {
			throw new Error('Invalid .zip central directory')
		}
		const flags = zip.readUInt16LE(offset + 8)
		const method = zip.readUInt16LE(offset + 10)
		const crc = zip.readUInt32LE(offset + 16)
		const compressedSize = zip.readUInt32LE(offset + 20)
		const size = zip.readUInt32LE(offset + 24)
		const nameLength = zip.readUInt16LE(offset + 28)
		const localOffset = zip.readUInt32LE(offset + 42)
		const entryName = zip.toString('utf8', offset + 46, offset + 46 + nameLength)
		offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32)
		if (entryName !== name) {
			continue
		}

		if (flags & 1) {
			throw new Error(`${name} is encrypted`)
		}
		if ([compressedSize, size, localOffset].includes(0xffffffff)) {
			throw new Error(`${name} is in the ZIP64 format, which isn't supported`)
		}
		if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
			throw new Error(`Invalid .zip header for ${name}`)
		}
		const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28)
		const compressed = zip.subarray(start, start + compressedSize)
		let data
		if (method === 0) {
			data = compressed
		} else if (method === 8) {
			data = zlib.inflateRawSync(compressed, { maxOutputLength: Math.max(size, 1) })
		} else {
			throw new Error(`${name} uses the unsupported compression method ${method}`)
		}
		if (data.length !== size || zlib.crc32(data) !== crc) {
			throw new Error(`${name} failed its CRC check`)
		}
		return data
	}

	throw new Error(`${name} was not found in the .zip file`)
}

async function main() {
	await downloadFile()

	// Parse the TDC.dat file, using its header for the version.
	const dat = await datfile.parseFile(tdcFile)
	const header = dat.shift()
	const version = getVersion(header.date)
	const database = buildDatabase(dat)

	// Save the file.
	fs.writeFileSync('libretro-database/dat/DOS.dat', formatDat(database, version))
	console.log(`Wrote ${database.length} games to libretro-database/dat/DOS.dat (version ${version})`)
}

/**
 * Builds the sorted list of games from the parsed TDC entries.
 */
function buildDatabase(games, extraGames = additions) {
	const releases = []
	for (const game of games) {
		if (!acceptableGame(game.name)) {
			continue
		}
		releases.push({
			name: cleanGameName(game.name),
			meta: getMetadata(game.name),
			files: (game.entries || []).filter(file => file.crc)
		})
	}

	// Releases like disk images often have no genre, so use the genre from another release of the game.
	const nameGenres = new Map()
	for (const release of releases) {
		if (release.meta.genre && !nameGenres.has(release.name)) {
			nameGenres.set(release.name, release.meta.genre)
		}
	}
	for (const release of releases) {
		if (!release.meta.genre && nameGenres.has(release.name)) {
			release.meta = { genre: nameGenres.get(release.name), ...release.meta }
		}
	}

	// Find the game name that owns each CRC. Files shared between games, like
	// QBASIC.EXE or DOS4GW.EXE, can't identify a game so are marked null.
	const owners = new Map()
	for (const release of releases) {
		for (const file of release.files) {
			const crc = file.crc.toUpperCase()
			const owner = owners.get(crc)
			owners.set(crc, owner === undefined || owner === release.name ? release.name : null)
		}
	}

	// Identify each release by the largest file that no other game has, preferring
	// executables in the root, then executables in subdirectories, then disk images.
	const database = new Map()
	for (const release of releases) {
		let finalFile = null
		for (const file of release.files) {
			const filename = acceptableFile(file)
			if (!filename || owners.get(file.crc.toUpperCase()) !== release.name) {
				continue
			}
			const rank = getFileRank(file)
			if (!finalFile || rank < finalFile.rank || (rank === finalFile.rank && Number(file.size) > Number(finalFile.size))) {
				finalFile = { ...file, filename, rank }
			}
		}
		const crc = finalFile ? finalFile.crc.toUpperCase() : null
		if (crc && !database.has(crc)) {
			database.set(crc, {
				name: release.name,
				filename: finalFile.filename,
				size: Number(finalFile.size),
				crc,
				meta: release.meta
			})
		}
	}

	// Add the extra games, replacing any TDC entry that has the same CRC.
	for (const game of extraGames) {
		const crc = game.crc.toUpperCase()
		database.set(crc, { ...game, crc })
	}

	return Array.from(database.values()).sort(compareGames)
}

/**
 * Sorts games by name, and then by CRC so that the output is stable.
 */
function compareGames(a, b) {
	if (a.name !== b.name) {
		return a.name < b.name ? -1 : 1
	}
	return a.crc < b.crc ? -1 : a.crc > b.crc ? 1 : 0
}

/**
 * Outputs the database in the clrmamepro DAT format.
 */
function formatDat(database, version) {
	const extensions = [...acceptableExtensions, ...diskImageExtensions].map(extension => extension.replace(/^\./, '')).join('|')
	let output = `clrmamepro (
	name "DOS"
	description "DOS"
	version "${version}"
	extensions "${extensions}"
	comment "libretro | www.libretro.com"
	homepage "${pkg.homepage}"
)
`

	for (const game of database) {
		let meta = ''
		for (const metaEntry in game.meta) {
			meta += `\n\t${metaEntry} "${game.meta[metaEntry]}"`
		}
		output += `
game (
	name "${game.name}"${meta}
	rom ( name "${game.filename}" size ${game.size} crc ${game.crc} )
)
`
	}

	return output
}

/**
 * Converts the TDC header date, like "Sunday, October 25, 2026@00:00", to a version like "2026.10.25".
 */
function getVersion(date) {
	const match = /([A-Z][a-z]+) (\d{1,2}), (\d{4})/.exec(date || '')
	const month = match ? months.indexOf(match[1]) + 1 : 0
	if (!month) {
		throw new Error(`Unable to read the date from the TDC header: ${date}`)
	}
	return `${match[3]}.${month}.${Number(match[2])}`
}

/**
 * Retrieves all the [] tags from the given game name, splitting [Action, Sports] into separate tags.
 */
function getTags(name) {
	const tags = []
	for (const match of name.matchAll(/\[([^[\]]*)\]/g)) {
		for (const tag of match[1].split(',')) {
			if (tag.trim()) {
				tags.push(tag.trim())
			}
		}
	}
	return tags
}

/**
 * Checks to see if the given game name is an acceptable game to index.
 */
function acceptableGame(name) {
	if (rejectGames.some(reject => name.includes(reject))) {
		return false
	}

	// Reject cracks, trainers, documentation, utilities and bad dumps.
	return !getTags(name).some(tag => rejectTags.some(pattern => pattern.test(tag)))
}

/**
 * Checks if the given file is acceptable, returning its filename.
 */
function acceptableFile(file) {
	if (!file.name) {
		return false
	}

	const pathObject = path.parse(file.name.replaceAll('\\', '/'))
	const extension = pathObject.ext.toLowerCase()
	if (!acceptableExtensions.includes(extension) && !diskImageExtensions.includes(extension)) {
		return false
	}

	// Reject setup or install files, along with the rejected names.
	const name = pathObject.name.toLowerCase()
	if (name.includes('setup') || name.includes('install') || rejectNames.includes(name)) {
		return false
	}

	return pathObject.base
}

/**
 * Ranks how the given file identifies a game, with root executables at 0 and disk images in subdirectories at 3.
 */
function getFileRank(file) {
	const pathObject = path.parse(file.name.replaceAll('\\', '/'))
	return (diskImageExtensions.includes(pathObject.ext.toLowerCase()) ? 2 : 0) + (pathObject.dir ? 1 : 0)
}

/**
 * Cleans the given game name down to its title.
 */
function cleanGameName(name) {
	// Remove the suffixing file extension.
	let output = name.replace(/(\.(img|ima|jrc))?\.zip$/i, '')

	// The title is everything before the (Year)(Publisher).
	const release = output.match(releasePattern)
	if (release) {
		output = output.slice(0, release.index)
	}
	const demo = /\([^()]*\bdemo\b[^()]*\)/i.test(output)

	output = output
		// Remove all [] data, keeping the "][" in titles like "Pyro ][".
		.replace(/\[[^[\]]*\]/g, ' ')
		// Remove all () data, like languages (De) and video modes (EGA).
		.replace(/\((?:[^()]|\([^()]*\))*\)/g, ' ')
		// Remove the version and revision, like v1.2 or r930427.
		.replace(/\sv\d\S*/g, ' ')
		.replace(/\sr\d+[a-z]?(?=\s|$)/g, ' ')
		.replaceAll('"', '')
		.replace(/\s+/g, ' ')
		.trim()
		// Use colons for the "- " and " - " subtitles, like "Maniac Mansion- Day of the Tentacle".
		.replace(/(\S) ?- (?=\S)/g, '$1: ')

	return demo ? `${output} (Demo)` : output
}

/**
 * Retrieves any meta entries for the given game name.
 */
function getMetadata(name) {
	const meta = {}

	const genre = getTags(name).find(tag => Object.hasOwn(genres, tag))
	if (genre) {
		meta.genre = genres[genre]
	}

	const release = name.match(releasePattern)
	if (release) {
		if (/^\d{4}$/.test(release[1])) {
			meta.releaseyear = release[1]
		}
		const developer = release[2].replaceAll('"', '').trim()
		if (developer && developer !== '-') {
			meta.developer = Object.hasOwn(developers, developer) ? developers[developer] : developer.replace(companySuffix, '')
		}
	}

	return meta
}

if (require.main === module) {
	main().catch(err => {
		console.error(err)
		process.exitCode = 1
	})
}

module.exports = {
	acceptableFile,
	acceptableGame,
	buildDatabase,
	cleanGameName,
	formatDat,
	getMetadata,
	getTags,
	getVersion,
	readZipEntry
}
