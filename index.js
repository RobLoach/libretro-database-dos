var fs = require('fs')
var path = require('path')
var acceptableExtensions = require('./lib/acceptableExtensions.json')
var rejectNames = require('./lib/rejectNames.json')
var rejectGames = require('./lib/rejectGames.json')
var sortArray = require('sort-array')
var datfile = require('robloach-datfile')
const download = require('download')

async function downloadFile() {
	if (!fs.existsSync('TDC_Daily.dat')) {
		const downloadOpts = {
			extract: true,
			filename: 'TDC_Daily.dat'
		}
		await download('http://www.totaldoscollection.org/nugnugnug/tdc_daily.zip', '.', downloadOpts)
	}
}

async function goTime() {

	await downloadFile()
	// Options for reading the dat file.
	let opts = {
		ignoreHeader: true
	}

	// Parse the TDC.dat file.
	datfile.parseFile('TDC_Daily.dat', opts).then(function (dat) {
		let database = []
		for (let i in dat) {
			let game = dat[i]
			let finalFile = null
			if (!acceptableGame(game)) {
				continue
			}
			for (let i in game.entries || []) {
				let file = game.entries[i]
				let cleanFilename = acceptableFile(file)
				if (cleanFilename) {
					file.cleanFilename = cleanFilename
					finalFile = file
				}
			}
			if (finalFile) {
				finalFile.meta = getMetadata(game)
				database.push({
					name: cleanGameName(game.name),
					filename: finalFile.cleanFilename,
					size: finalFile.size,
					crc: finalFile.crc.toLowerCase(),
					meta: finalFile.meta
				})
			}
		}

		// Sort the database.
		database = sortArray(database, {
			by: 'name'
		})

		// Output the new DAT.
		var pkg = require('./package.json')
		var output = `clrmamepro (
	name "DOS"
	description "DOS"
	version ${pkg.version}
	comment "libretro | www.libretro.com"
	homepage "${pkg.homepage}"
)
`

		for (let i in database) {
			let game = database[i]
			let meta = ''
			for (let metaEntry in game.meta) {
				meta += `\n\t${metaEntry} "${game.meta[metaEntry]}"`
			}
			output += `
game (
	name "${game.name}"
	description "${game.name.replace(/\([\d\d\d\d]+\)/gm, '').trim()}"${meta}
	rom ( name "${game.filename}" size ${game.size} crc ${game.crc} )
)
`
		}

		// Save the file.
		fs.writeFileSync('libretro-database/dat/DOS.dat', output)
	}).catch(function (err) {
		// Output any errors.
		console.error(err)
	})
}

/**
 * Checks to see if the given file is an acceptable game to index.
 */
function acceptableGame(game) {
	for (let i in rejectGames) {
		if (rejectGames[i] && game.name.indexOf(rejectGames[i]) >= 0) {
			return false
		}
	}

	return true
}

/**
 * Checks if the given file is acceptable.
 */
function acceptableFile(file) {
	var filename = file.name
	filename = replaceAll(filename, '\\\\', '/')
	if (filename) {
		var pathObject = path.parse(filename)
		if (pathObject.dir) {
			return false
		}
		var extension = pathObject.ext.toLowerCase()
		if (acceptableExtensions.indexOf(extension) < 0) {
			return false
		}

		var name = pathObject.name.toLowerCase()

		// Reject setup or install files.
		let skipEntries = name.includes('setup') ||
			name.includes('install') ||
			name.includes('Crack]') ||
			name.includes('[Codes]') ||
			name.includes('[Solve]') ||
			name.includes('[Documentation]') ||
			name.includes('[Manual]') ||
			name.includes('Docs]') ||
			name.includes('[Walkthrough]') ||
			name.includes('[Hints]')
		if (skipEntries) {
			return false
		}

		// Check against the rejected names.
		if (rejectNames.indexOf(name) >= 0) {
			return false
		}

		return pathObject.base
	}
	return false
}

/**
 * Cleans the given game name.
 */
function cleanGameName(name) {
	// Remove the suffixing file extension.
	let output = name.replace('.zip', '')

	// Remove an entry that breaks brackets.
	output = output.replace('(Interactive Television Entertainment)', '')

	// Remove all [] data.
	output = output.replace(/\[.*?\]/g, '')

	// Remove all languages. (En)(It)
	//output = output.replace(/(\(..\))/gm, '')

	// Remove all () data, except year
	output = output.replace(/\([^\d\d\d\d]+\)/gm, '')

	// Remove the version.
	var ver = output.match(/ v[0-9.]{3,9}/g)
	if (ver && ver[0]) {
		output = output.replace(ver[0], '')
	}

	output = output.replaceAll('"', '')

	// Replace any double spaces with a single space.
	output = output.split('  ').join(' ')

	return output.trim()
}

/**
 * Retrieves any meta entries for the game.
 */
function getMetadata(game) {
	let meta = {}
	let name = game.name
	let genres = {
		'Action': 'Action',
		'Adventure': 'Adventure',
		'Strategy': 'Strategy',
		'Sports': 'Sports',
		'Role-Playing (RPG)': 'RPG',
		'Educational': 'Educational',
		'Simulation': 'Simulation',
		'Trainer': 'Trainer'
	}
	for (let genre in genres) {
		if (name.indexOf('[' + genre + ']') > 3) {
			meta.genre = genres[genre]
			break
		}
	}

	for (let i = 1980; i < 2030; i++) {
		if (name.indexOf('(' + i + ')') > 3) {
			meta.year = i
			break
		}
	}

	// TODO: Find languages
	//name.search(output.replace(/(\(..\))/gm, '')

	// Find the developer
	let companyNumber = 0
	let match = name.match(/\([a-zA-Z\s,.]{3,}\)/gm)
	if (match) {
		let companyName = match[0]
		meta.developer = companyName.replaceAll('(', '').replaceAll(')', '')
	}

	return meta
}

/**
 * Replace all instances of a given string with another one.
 */
function replaceAll(str, find, replace) {
	if (str && str.replace) {
		return str.replace(new RegExp(find, 'g'), replace);
	}
	else {
		return str
	}
}

goTime()
