var fs = require('fs')
var path = require('path')
var readline = require('readline')
var acceptableExtensions = require('./lib/acceptableExtensions.json')
var rejectNames = require('./lib/rejectNames.json')
var rejectGames = require('./lib/rejectGames.json')
var sortObject = require('sort-object')

var lineReader = readline.createInterface({
  input: fs.createReadStream('TDC.dat')
});

var database = {}
var currentGame = ''

lineReader.on('line', function (line) {
	// New Game Name
	if (line.indexOf('name "') >= 0) {
		// Deny installer, trainers or cheats runnings.
		for (var type in rejectGames) {
			if (line.indexOf(rejectGames[type]) > 0) {
				currentGame = null
				return
			}
		}

		currentGame = cleanGameName(line)
		database[currentGame] = {}
	}
	// File entry
	else if (line.indexOf('file (') >= 0) {
		// See if we are acting on the given game.
		if (currentGame) {
			// Clean up the file.
			var file = cleanFile(line)
			database[currentGame][file.name] = file
		}
	}
})

function acceptableFile(file) {
	if (file.pathObject.dirname) {
		return false
	}
	var extension = file.pathObject.ext.toLowerCase()
	if (acceptableExtensions.indexOf(extension) < 0) {
		return false
	}

	var name = file.pathObject.name.toLowerCase()
	if (rejectNames.indexOf(name) >= 0) {
		return false
	}

	return true
}

lineReader.on('close', function () {
	database = sortObject(database)
  var pkg = require('./package.json')
  var output = `clrmamepro (
	name "DOS"
	description "DOS"
	version ${pkg.version}
	comment "libretro | www.libretro.com"
	homepage "${pkg.homepage}"
)
`
  for (var name in database) {
  	var finalFile = null
  	var files = database[name]
  	for (var filename in files) {
  		var file = files[filename]
  		if (acceptableFile(file)) {
			finalFile = file
  		}
  	}

  	if (finalFile) {
	  	output += `
game (
	name "${name}"
	rom ( name "${finalFile.pathObject.base}" size ${finalFile.size} crc ${finalFile.crc} )
)
`
  	}
  }
  fs.writeFileSync('DOS.dat', output)
})

function cleanGameName(name) {
	// Remove the prefixing "name".
	var output = name.trim().replace('name "', '')

	// Remove the suffixing file extension.
	output = output.replace('.zip"', '')

	// Remove all [] data.
	output = output.replace(/\[.*?\]/g, '')

	// Remove the year.
	output = output.replace(/\(\d\d\d\d\)/g, '')

	// Remove all () data.
	//output = output.replace(/\(.*?\)/g, '')

    // Replace any double spaces with a single space.
	output = output.split('  ').join(' ')

	return output.trim()
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function cleanFile(file) {
	var output = file.trim()
	output = output.replace('file ( ', '')

    // Build a regex to find the file information.
	var regex = /name (.*) size (\S*) date (\S*) (\S*) crc (\S*) \)/g
	var match = regex.exec(output)

	// Error out if the regex failed.
	if (!match) {
		console.error('Failed to regex match ' + file)
		process.exit(1)
	}

	// Get the filename.
	var filename = match[1]

	// Replace Windows directory seperators with Unix /.
	filename = filename.split('\\').join('/')

	// Construct a path object.
	var pathObj = path.parse(filename)

	// Return the new file object.
	return {
		name: pathObj.base,
		size: match[2],
		crc: match[5],
		pathObject: pathObj
	}
}