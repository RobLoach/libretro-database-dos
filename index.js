var fs = require('fs')
var path = require('path')
var readline = require('readline')
var acceptableExtensions = require('./lib/acceptableExtensions.json')
var rejectNames = require('./lib/rejectNames.json')

var lineReader = readline.createInterface({
  input: fs.createReadStream('TDC.dat')
});

var database = {}
var currentGame = ''

lineReader.on('line', function (line) {
	// New Game Name
	if (line.indexOf('name "') >= 0) {
		currentGame = cleanGameName(line)
		// Do not add installers.
		if (currentGame.indexOf('(Installer)') >= 0) {
			currentGame = null
		} else {
			database[currentGame] = {}
		}
	}
	// File entry
	else if (line.indexOf('file (') >= 0) {
		if (currentGame) {
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
	var output = name.trim()
	output = output.replace('name "', '')
	output = output.replace('.zip"', '')
	// TODO: Clean the file more to match No-Intro naming.
	return output
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