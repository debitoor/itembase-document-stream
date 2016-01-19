#!/bin/bash
### Exit on any error
set -e

### Step helper functions
stepName=""
step_end(){
	echo "##teamcity[blockClosed name='${stepName}']"
}
step_start(){
	if [ "${stepName}" != '' ]
	then
		step_end
	fi
	stepName=`echo "-- $1 --"`
	echo "##teamcity[blockOpened name='${stepName}']"
}

### Steps
step_start 'remove node_modules'
rm -rf node_modules

step_start 'npm install'
npm install

step_start tests
npm run test-teamcity

step_end
