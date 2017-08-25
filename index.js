var fs = require('fs')
var path = require('path')
var acceptableExtensions = require('./lib/acceptableExtensions.json')
var rejectNames = require('./lib/rejectNames.json')
var rejectGames = require('./lib/rejectGames.json')
var sortArray = require('sort-array')
var datfile = require('robloach-datfile')

// Options for reading the dat file.
let opts = {
	ignoreHeader: true
}

// Parse the TDC.dat file.
datfile.parseFile('TDC.dat', opts).then(function (dat) {
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
				crc: finalFile.crc,
				meta: finalFile.meta
			})
		}
	}

	// Sort the database.
	database = sortArray(database, 'name')

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
	description "${game.name}"${meta}
	rom ( name "${game.filename}" size ${game.size} crc ${game.crc} )
)
`
	}

	// Save the file.
	fs.writeFileSync('DOS.dat', output)
}).catch(function (err) {
	// Output any errors.
	console.error(err)
})

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
	output = name.replace('.zip"', '')

	// Remove all [] data.
	output = output.replace(/\[.*?\]/g, '')

	// Remove the year.
	output = output.replace(/\(\d\d\d\d\)/g, '')

	output = output
		.replace('\\1981\\', '')
		.replace('\\1982\\', '')
		.replace('\\1983\\', '')
		.replace('\\1984\\', '')
		.replace('\\1985\\', '')
		.replace('\\1986\\', '')
		.replace('\\1987\\', '')
		.replace('\\1988\\', '')
		.replace('\\1989\\', '')
		.replace('\\1990\\', '')
		.replace('\\1991\\', '')
		.replace('\\1992\\', '')
		.replace('\\1993\\', '')
		.replace('\\1994\\', '')
		.replace('\\1995\\', '')
		.replace('\\1996\\', '')
		.replace('\\1997\\', '')
		.replace('\\1998\\', '')
		.replace('\\1999\\', '')
		.replace('\\2000\\', '')
		.replace('\\2001\\', '')
		.replace('\\2002\\', '')
		.replace('\\2003\\', '')
		.replace('\\2004\\', '')
		.replace('\\2005\\', '')
		.replace('\\2006\\', '')
		.replace('\\2007\\', '')
		.replace('\\2008\\', '')
		.replace('\\2009\\', '')
		.replace('\\2010\\', '')
		.replace('\\2011\\', '')
		.replace('\\2012\\', '')
		.replace('\\2013\\', '')
		.replace('\\2014\\', '')
		.replace('\\2015\\', '')
		.replace('\\2016\\', '')
		.replace('\\2017\\', '')
		.replace('\\2018\\', '')
		.replace('\\2019\\', '')

	// Remove the company.
	if (output.indexOf('(') >= 0) {
		output = output.slice(0, output.lastIndexOf('('))
	}

	// Remove all () data.
	//output = output.replace(/\(.*?\)/g, '')

	// Remove the version.
	var ver = output.match(/ v[0-9.]{3,9}/g)
	if (ver && ver[0]) {
		output = output.replace(ver[0], '')
	}

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
		if (name.search(genre) > 3) {
			meta.genre = genres[genre]
			break
		}
	}

	let currentYear = (new Date()).getFullYear()
	for (let i = 1980; i < currentYear; i++) {
		if (name.search('(' + i + ')') > 3) {
			meta.year = i
			break
		}
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
