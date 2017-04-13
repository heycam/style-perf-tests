var perf_data = {
  start: null,
  end: null,
}

function build_dom(n, elemName) {
  var ours = document.createElement(elemName);
  if (n != 1) {
    var leftSize = Math.floor(n/2);
    var rightSize = Math.floor((n-1)/2);
    ours.appendChild(build_dom(leftSize, elemName));
    if (rightSize > 0)
      ours.appendChild(build_dom(rightSize, elemName));
  }
  return ours;
}

function build_rule(selector, selectorRepeat, declaration) {
  var s = document.createElement("style");
  s.textContent = Array(selectorRepeat).fill(selector).join(", ") + declaration;
  return s;
}

function perf_start() {
  if (perf_data.start !== null) {
    throw "already started timing!";
  }

  perf_data.start = performance.now();
}

function perf_finish() {
  var end = performance.now();

  if (perf_data.start === null) {
    throw "haven't started timing!";
  }

  if (perf_data.end !== null) {
    throw "already finished timing!";
  }

  var start = perf_data.start;
  perf_data.end = end;

  // when running in talos report results; when running outside talos just alert
  if (window.tpRecordTime) {
    window.tpRecordTime(end - start, start);
  } else {
    console.log(end);
    console.log(start);
    alert("Result: " + (end - start).toFixed(2) + " (ms)");
  }
}
