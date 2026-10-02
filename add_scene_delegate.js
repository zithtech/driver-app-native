const xcode = require('xcode');
const fs = require('fs');

const projectPath = 'ios/DriverClient.xcodeproj/project.pbxproj';
const myProj = xcode.project(projectPath);

myProj.parse(function (err) {
    if (err) {
        console.error('Error parsing project:', err);
        process.exit(1);
    }
    
    // Add the file to the project
    const file = myProj.addSourceFile('SceneDelegate.swift', null, myProj.getFirstTarget().uuid);
    if (!file) {
        console.log("File probably already exists in project.");
    } else {
        console.log("Successfully added SceneDelegate.swift to project.");
    }
    
    fs.writeFileSync(projectPath, myProj.writeSync());
});
