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
	  		database.push({
	  			name: cleanGameName(game.name),
	  			filename: finalFile.cleanFilename,
	  			size: finalFile.size,
	  			crc: finalFile.crc
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
		output += `
game (
	name "${game.name}"
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
 * Replace all instances of a given string with another one.
 */
function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}
