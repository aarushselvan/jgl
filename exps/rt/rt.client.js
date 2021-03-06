
function loadTask() {
	var task = [];
	// CONSENT
	task[0] = {};
	task[0].type = 'consent';
	// consent is a default type with no callbacks
	task[0].variables = {};
	task[0].variables.consent = NaN;
	// consent has no data

	// RT TRIALS
	task[1] = {};
	task[1].type = 'trial'; // this will give us use of the canvas
	task[1].callbacks = {};
	task[1].callbacks.updateScreen = updateScreen;
	task[1].callbacks.getResponse = getResponse;
	// RT task doesn't have any parameters, but this gets auto-populated with data
	task[1].parameters = {};
	// RT task won't log any variables either (these get set by the user somewhere in the callbacks)
	// caution: these need a value (e.g. NaN) or they won't run correctly
	task[1].variables = {};
	task[1].variables.key = undefined;
	// Segment timing
	task[1].segnames = ['delay','stim','iti'];
	// Seglen uses specific times
	task[1].segmin = [500,1000,1000];
	task[1].segmax = [2000,1000,3000];
	// Responses
	task[1].response = [0,1,0];
	// Trials
	task[1].numTrials = 5; // can't be infinite, best to have smaller blocks with breaks in between (e.g. an instruction page that is blank)
	// Keys
	task[1].keys = 32;

	return task;
}

function updateScreen() {
	if (jgl.trial.segname=='delay') {
		jglFixationCross();
	}
	if (jgl.trial.segname=='stim' && !jgl.trial.responded[jgl.trial.thisseg]) {
		jglFillRect(0,0,[1,1],'#ffffff');
	}
	if (jgl.trial.segname=='stim' && jgl.trial.responded[jgl.trial.thisseg]) {
		if (jgl.trial.RT[jgl.trial.thisseg]<300) {
			jglTextSet('Arial',20,'#00ff00');
		} else {
			jglTextSet('Arial',20,'#ff0000');
		}
		jglTextDraw(Math.round(jgl.trial.RT[jgl.trial.thisseg]),0,0);
	}
}

function getResponse() {
	jgl.trial.key = jgl.event.key.keyCode;
}