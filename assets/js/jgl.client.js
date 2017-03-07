// JGL Client-side code
// *You should not need to modify this*

// The JGL client-side code deals with modifying the exp.html page
// according to the current experiment, and running the client-side functions.
// It runs in "blocks" defined in the task list. After each block
// it sends data to the server, and upon completion of the experiment it
// closes all windows and shuts down MTurk (via opener.turk, and the mmturkey)
// plugin.

// A warning about JGL compared to MGL. JGL strings commands together at times--but they operate asynchronously:
// i.e. if you call a function from within a function, there is no guarantee that the inner function returns before
// the outer one continues. Keep this in mind when you write your code :)

var socket;

///////////////////////////////////////////////////////////////////////
//////////////////////// JGL FUNCTIONS ////////////////////////////////
///////////////////////////////////////////////////////////////////////

$(document).ready(function() {launch();});

var divList = ['error','loading'];

var task; // task structure created by experiment code
var jgl = {}; // stuff that gets tracked (worker id, etc)

function launch() {
	jgl.screenInfo = screenInfo();

	var fList = [initJGL,getExperiment,loadTemplate,getAmazonInfo,loadExperiment,loadTask_,preloadInstructions,updateFromServer,function() {if (debug) {start();}}];
	
	for (var fi=0;fi<fList.length;fi++) {
		setTimeout(fList[fi],fi*200);
	}
}

var exp, debug;
var callbackActive = [];

function screenInfo() {
	// Get DPI
	var screenInfo = {};
	var dpi_x = document.getElementById('dpi').offsetWidth;
	var dpi_y = document.getElementById('dpi').offsetHeight;
	if ((!(dpi_x==dpi_y)) || dpi_x==0 || dpi_y == 0) {error('There is an issue with your screen--you cannot continue');return}
	screenInfo.PPI = dpi_x;
	screenInfo.PPcm = screenInfo.PPI/2.54;
	screenInfo.screenSize = window.screen.width/screenInfo.PPcm; // in cm
	screenInfo.screenDistance = 60; // in cm
	screenInfo.totalcm = 2*Math.PI*screenInfo.screenDistance; // Total CM for 360 degrees
	screenInfo.pixPerDeg = screenInfo.PPcm*screenInfo.totalcm/360;

	$("#dpi").hide();

	return screenInfo;
}

function getExperiment() {
	debug = Number(getQueryVariable('debug'));
	exp = getQueryVariable('exp');    
	if (exp==undefined) {
		error('noexp');
		return;
	}
	if (!debug) {socket = io(); setupSocket();}
}

function setupSocket() {
	socket.on('update', function(msg) {
		console.log('Server connection succeeded currently at block ' + (Number(msg)+1));
		// Format is block
		// msg = msg.split('.');
		jgl.curBlock = Number(msg); //[0];
		jgl.curTrial = -1; // we only send data per block, so we're stuck re-starting at the first trial
		start();
	});

	socket.on('check', function() {
		jgl.serverConnected = true;
	});

	socket.on('submitted', function() {
		jgl.live = false;
		error('You already participated and submitted this HIT. Please release it for another participant.');
	});
}

function initJGL() {
	jgl.timing = {};
	jgl.live = false;
	jgl.serverConnected = -1;
}

function getAmazonInfo() {
	// these are NOT accessible to the server!
	if (debug==0) {
		jgl.assignmentId = opener.assignmentId;
		jgl.workerId = opener.workerId;
		// only the hash and hit ID are sent to the server--perfect anonymity, even across experiments
		jgl.hash = md5(jgl.workerId + exp);
		jgl.hitId = opener.hitId;
	} else {
		jgl.assignmentId = 'debug';
		jgl.workerId = 'debug';
		jgl.hash = md5(jgl.workerId + exp);
		jgl.hitId = 'debug';
	}
}

function submitHIT() {
	if (debug) {
		error('Normally the HIT would now be submitted');
		return
	}
	if (opener==undefined) {
		error('You did not keep the Amazon MTurk page open. Please re-open the HIT on MTurk and start again--it will take you directly to the final page and allow you to submit');
		return
	}
	// Otherwise, communicate with the server and submit
	socket.emit('submit');
	opener.submit();
}

function loadTemplate() {
	var tempList = ['complete'];
	for (var i=0;i<tempList.length;i++) {
		addDiv(tempList[i]);
	}
}

function loadExperiment() {
	// Load experiment code
	$.getScript('exps/'+exp+'/'+exp+'.client.js');
}

function updateFromServer() {
	if (debug==1) {
		jgl.curBlock = -1; // -1 before starting
		jgl.curTrial = -1; // -1 before starting
	} else {
		console.log('Attempting server connection');
		socket.emit('login',exp+'.'+jgl.hash);
		checkServerStatus();
	}
}

function checkServerStatus() {
	if (!jgl.serverConnected) {
		alert('The server appears to be disconnected. Data from the current block will not be saved. Please re-connect via MTurk--if this persists please e-mail gruturk@gmail.com');
	}
	jgl.serverConnected = false;
	socket.emit('check');

	setTimeout(checkServerStatus,10000);
}

function hideAll() {
	for (var di in divList) {
		$("#"+divList[di]).hide();
	}
}

function start() {
	console.log('Experiment starting');
	jgl.timing.experiment = now();
	jgl.live = true;
	startBlock_();
}

function error(type) {
	hideAll();
	$("#error").show();
	switch (type) {
		case 'noexp':
			$("#error-text").text('An error occurred: no experiment was specified in the html query string. Please send this error to the experimenter (gruturk@gmail.com).');
			break;
		default:
			$("#error-text").text('An error occurred: ' + type);
	}
}

///////////////////////////////////////////////////////////////////////
//////////////////////// DEFAULT CODE ////////////////////////////////
///////////////////////////////////////////////////////////////////////

function consentEnd() {
	jgl.trial.consent = true;
	endBlock_();
}

function completeEnd() {
	submitHIT();
}

function addDiv(div) {
	console.log('Adding div: ' + div);
	divList.push(div);
	$.get('assets/templates/'+div+'.html', function(data) {$('#content').append(data);});
	$("#"+div).hide();
}

function processTask(task) {
	for (var ti=0;ti<task.length;ti++) {
		if (task[ti].type!=undefined) {
			if (divList.indexOf(task[ti].type)==-1) {
				addDiv(task[ti].type);
			}
		}
		// setup trials
		task[ti].trials = [];
		for (var i=0;i<task[ti].numTrials;i++) {
			task[ti].trials[i] = {};
			// RESPONSE WATCH
			task[ti].trials[i].response = task[ti].response;
			// BLOCK RANDOMIZATION (setup parameters)
			if (task[ti].parameters!=undefined) {
				console.log('WARNING: Block randomization is not implemented. Using equal probabilities.');
				var params = Object.keys(task[ti].parameters);
				for (var pi=0;pi<params.length;pi++) {
					task[ti].trials[i][params[pi]] = randomElement(task[ti].parameters[params[pi]]);
				}
			}
			// VARIABLES
			if (task[ti].variables!=undefined) {
				var vars = Object.keys(task[ti].variables);
				for (var vi=0;vi<vars.length;vi++) {
					task[ti].trials[i][vars[vi]] = NaN;
				}
			}
			// SEGMENT TIMING (setup timing)
			if (task[ti].seglen!=undefined) {
				// seglen overrides min/max
				task[ti].trials[i].seglen = task[ti].seglen;
			} else if (task[ti].segmin!=undefined) {
				if (task[ti].segmax==undefined) {error('An error occurred: segment maximum was not defined');}
				else {
					task[ti].trials[i].seglen = [];
					task[ti].trials[i].length = 0;
					for (var si=0;si<task[ti].segmin.length;si++) {
						if (task[ti].segmin[si]==task[ti].segmax[si]) {
							task[ti].trials[i].seglen[si] = task[ti].segmax[si];
						} else {
							task[ti].trials[i].seglen[si] = task[ti].segmin[si] + Math.random()*(task[ti].segmax[si]-task[ti].segmin[si]);
						}
						task[ti].trials[i].length += task[ti].trials[i].seglen[si];
					}
				}
			}
		}
	}
	task.push({type:'complete',callbacks:{}});
}

function loadTask_() {
	// Run the user defined function
	jgl.task = loadTask();
	// Take the task and process it
	processTask(jgl.task);
}

function setupCanvas() {
	jgl.canvas = document.getElementById("canvas");
	jgl.canvas.width = window.innerWidth-50;
	jgl.canvas.degX = jgl.canvas.width/jgl.screenInfo.pixPerDeg;
	jgl.canvas.height = window.innerHeight-50;
	jgl.canvas.degY = jgl.canvas.height/jgl.screenInfo.pixPerDeg;
	// if (window.innerWidth<1024 || window.innerHeight<768) {error('Your screen is not large enough to support our experiment. Please maximize the window or switch to a larger screen and refresh the page.');}
	jgl.ctx = jgl.canvas.getContext("2d");
	console.log('remove when real visual angle coordinates est');
	jgl.canvas.pixPerDeg = jgl.screenInfo.pixPerDeg;
	jgl.canvas.background = 0.5;
	jglVisualAngleCoordinates();
	// Add event listeners
	if (jgl.task[jgl.curBlock].keys!=undefined) {document.addEventListener('keydown',keyEvent,false);}
	if (jgl.task[jgl.curBlock].mouse!=undefined) {document.addEventListener('click',clickEvent,false);}
}

///////////////////////////////////////////////////////////////////////
//////////////////////// EVENT HANDLERS ////////////////////////////////
///////////////////////////////////////////////////////////////////////

function keyEvent(event) {
	if (event.which==32) {event.preventDefault();} // block spacebar from dropping

	jgl.event.key = {};
	jgl.event.key.keyCode = event.which;

	getResponse_();
}

function clickEvent(event) {
	jgl.event.mouse = {};

  var rect = jgl.canvas.getBoundingClientRect(), // abs. size of element
    scaleX = jgl.canvas.width / rect.width,    // relationship bitmap vs. element for X
    scaleY = jgl.canvas.height / rect.height;  // relationship bitmap vs. element for Y

  jgl.event.mouse.x =  (event.clientX - rect.left) * scaleX;  // scale mouse coordinates after they have
  jgl.event.mouse.y =  (event.clientY - rect.top) * scaleY;    // been adjusted to be relative to element

  jgl.event.mouse.shift = event.shiftKey;

  getResponse_();
}

///////////////////////////////////////////////////////////////////////
//////////////////////// CALLBACKS ////////////////////////////////
///////////////////////////////////////////////////////////////////////

function endExp_() {
	console.log('Experiment complete');

	if (jgl.callbacks.endExp!=undefined) {jgl.callbacks.endExp();}
}

// All JGL callbacks have an underscore, client callbacks are stored in the callbacks object
function startBlock_() {
	// increment block
	jgl.curBlock++;
	if (!debug) {socket.emit('block',jgl.curBlock);}
	jgl.curTrial = -1;

	// Check if we need to end the experiment
	if (jgl.curBlock>=(jgl.task.length)) {endExp_(); return}

	jgl.live = true;

	// Setup the block
	if (jgl.task[jgl.curBlock].callbacks!=undefined) {
		jgl.callbacks = jgl.task[jgl.curBlock].callbacks;
	} else {
		jgl.callbacks = {};
	}

	hideAll();
	$("#"+jgl.task[jgl.curBlock].type).show();

	// run the experiment callback if necessary
	if (jgl.callbacks.startBlock) {jgl.callbacks.startBlock(jgl.task);}

	if (jgl.task[jgl.curBlock].type=='trial') {
		// trials use the update_() code and a canvas to render
		// set up canvas
		setupCanvas();
	} else {
		jgl.trial = {}; // we need this to store saved data
		switch (jgl.task[jgl.curBlock].type) {
			// Anything that isn't a trial/canvas just waits for a submit function
			// (these could be instructions, forms, surveys, whatever)
			case 'consent':
				jgl.endBlockFunction = consentEnd;
				break;
			case 'complete':
				jgl.endBlockFunction = completeEnd;
				break;
			case 'instructions':
				setupInstructions();
				jgl.endBlockFunction = instructionsEnd;
				break;
			default:
				if (jgl.task[jgl.curBlock].endBlockFunction==undefined) {error('An error occurred: no endblock function was defined, this block will never end');}
				jgl.endBlockFunction = jgl.task[jgl.curBlock].endBlockFunction;
		}
	}

	if (jgl.task[jgl.curBlock].type=='trial' || jgl.task[jgl.curBlock].canvas==1) {
		jgl.timing.block = now();
		elapsed();
		jgl.tick=-1;
		update_();
	}
}

function update_() {
	if (!jgl.live) {return}

	var cblock = jgl.curBlock;
	var t = elapsed(); // get elapsed time
	// Check first trial
	if (jgl.curTrial==-1) {startTrial_();}
	// Check next trial
	if ((now()-jgl.timing.trial)>jgl.trial.length) {startTrial_();}
	// Next trial may have shut down the block, check this
	if (cblock != jgl.curBlock) {return}
	// Check next segment
	if ((now()-jgl.timing.segment)>jgl.trial.seglen[jgl.trial.thisseg]) {startSegment_();}

	// Update screen
	updateScreen_(t);

	jgl.tick = requestAnimationFrame(update_);
}

function endBlock_() {
	jgl.live = false;
	// run standard code
	cancelAnimationFrame(jgl.tick);

	// remove event listeners
	if (jgl.task[jgl.curBlock].keys!=undefined) {document.removeEventListener('keydown',keyEvent,false);}
	if (jgl.task[jgl.curBlock].mouse!=undefined) {document.removeEventListener('click',clickEvent,false);}
	
	var data = {};
		
	if (jgl.task[jgl.curBlock].type=='trial') {
		// save data into task[jgl.curBlock].datas 
		// copy parameters
		var params = Object.keys(jgl.task[jgl.curBlock].parameters);
		for (var pi=0;pi<params.length;pi++) {
			data[params[pi]] = jgl.trial[params[pi]];
		}

		// copy variables
		var variables = Object.keys(jgl.task[jgl.curBlock].variables);
		for (var vi=0;vi<variables.length;vi++) {
			data[variables[vi]] = jgl.trial[variables[vi]];
		}

		// copy defaults (RT, response, correct)
		var defaults = ['RT','response','correct'];
		for (var di=0;di<defaults.length;di++) {
			// these might not be defined, so don't just copy by default
			if (jgl.trial[defaults[di]]!=undefined) {data[defaults[di]] = jgl.trial[defaults[di]];}
		}
	} else {
		// copy variables
		var variables = Object.keys(jgl.task[jgl.curBlock].variables);
		for (var vi=0;vi<variables.length;vi++) {
			data[variables[vi]] = jgl.trial[variables[vi]];
		}
	}

	if (jgl.callbacks.endBlock) {jgl.callbacks.endBlock();}

	// send to server
	if (!debug) {
		socket.emit('data',data);
	}

	// start the next block
	startBlock_();
}

function startTrial_() {
	jgl.curTrial++;
	// Check end block	
	if (jgl.curTrial>=jgl.task[jgl.curBlock].numTrials) {endBlock_();return}

	// Run trial:
	jgl.timing.trial = now();
	console.log('Starting trial: ' + jgl.curTrial);
	jgl.trial = jgl.task[jgl.curBlock].trials[jgl.curTrial];

	// Reset the event structure
	jgl.event = {};
	jgl.trial.responded = 0;

	// Start the segment immediately
	jgl.trial.thisseg = -1;
	startSegment_();

	if (jgl.callbacks.startTrial) {jgl.callbacks.startTrial();}
}

function endTrial_() {

	if (jgl.callbacks.endTrial) {jgl.callbacks.endTrial();}
}

function startSegment_() {

	jgl.trial.thisseg++;
	jgl.trial.segname = jgl.task[jgl.curBlock].segnames[jgl.trial.thisseg];

	jgl.timing.segment = now();

	if (jgl.callbacks.startSegment) {jgl.callbacks.startSegment();}
}

function updateScreen_(time) {
	var framerate = 1000/time;
	// Clear screen
	jglClearScreen();
	// jgl.ctx.font="1px Georgia";
	// jgl.ctx.fillText('Trial: ' + jgl.curTrial + ' Segment: ' + jgl.trial.thisseg,-5,-5);

	if (jgl.callbacks.updateScreen) {jgl.callbacks.updateScreen();}
}

function getResponse_() {
	if (!jgl.live) {return}
	// actual event -- do nothing unless subject requests
	if (jgl.trial.response[jgl.trial.thisseg]) {
		if (jgl.trial.responded>0) {
			jgl.trial.responded++;
			console.log('Multiple responses recorded: ' + jgl.trial.responded);
			return
		}
		// called by the event listeners on the canvas during trials
		jgl.trial.RT = now() - jgl.timing.segment;
		jgl.trial.responded = true;		
		// call the experiment callback
		if (jgl.callbacks.getResponse && jgl.trial.responded) {jgl.callbacks.getResponse();}
	}
}



///////////////////////////////////////////////////////////////////////
//////////////////////// INSTRUCTIONS ////////////////////////////////
///////////////////////////////////////////////////////////////////////

function preloadInstructions() {
	// JGL NOTE: Only store instruction divs in the local exp.html file
	// General templates should be shared in assets/templates so that 
	// everybody can use them
	$.get('exps/'+exp+'/'+exp+'.html', function(data) {$('#instructionsdiv').append(data);})
}

function setupInstructions() {
	jgl.instructions = jgl.task[jgl.curBlock].instructions;
	jgl.instructions.push("instructions-end");
	jgl.curInstructions = -1;

	incInstructions(1);
}

function displayInstructions() {
	for (var i=0;i<jgl.instructions.length;i++) {
		$("#"+jgl.instructions[i]).hide();
	}
	$("#"+jgl.instructions[jgl.curInstructions]).show();
}

function incInstructions(increment) {
	jgl.curInstructions+=increment;
	// check end conditions
	if (jgl.curInstructions>=jgl.instructions.length) {
		jgl.endBlockFunction();
	}
	// set prev/next buttons
	if (jgl.curInstructions==0) {
		// disable prev
		$("#inst-prev").prop("disabled",true);
	} else {
		$("#inst-prev").prop("disabled",false);
	}
	// show the right instructions slide
	displayInstructions();
}

function instructionsEnd() {
	endBlock_();
}