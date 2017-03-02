// This is the ad logic. You shouldn't need to edit this unless you're running your server somewhere other than the gru.stanford.edu server (which you shouldn't do).

var debug;

function getExperiment() {
	debug = getQueryVariable('debug')=='true';
}

window.onload = function() {
	debug = getQueryVariable('debug')=='true';
	if (debug || turk.previewMode==false) {
		document.getElementById("preview").style.display="none";
		document.getElementById("active").style.display="";
	} else {
		document.getElementById("preview").style.display="";
		document.getElementById("active").style.display="none";
	}
};

var experimentWindow,path,expName;

function openwindow() {
	path = location.pathname;
	expName = path.substr(path.indexOf('ad-')+3,path.indexOf('.html')-(path.indexOf('ad-')+3));
	experimentWindow = window.open('http://localhost:8080/exp.html?exp='+expName,'Popup','toolbar=no,status=no,menubar=no,scrollbars=yes,resizable=no,width='+1024+',height='+768+'');
}

function submit() {
	var dataPackage = {
		turk:turk,
		path:path,
		expName:expName,
		success:true
	}
	experimentWindow.close();
	turk.submit(dataPackage);
}

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}