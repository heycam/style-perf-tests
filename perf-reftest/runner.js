const kTimeout = 10000;
const kEqualsTolerance = 0.2;  // longer of test and ref can take up to 20% more time
const kEqualsMin = 50;  // if test and ref take < 50ms, consider them equal
const kLessThanTolerance = 0.5;  // test must take < 50% of the ref running time

window.onload = function() {
  function set_status(text) {
    document.getElementById("status").textContent = text;
  }

  function query(key) {
    return location.search.substr(1)
      .split("&")
      .filter(v => v.startsWith(key + "="))
      .map(s => s.replace(/^[^=]*=/, ""))[0];
  }

  let test_frame = document.getElementById("test_frame");
  let reports = [];
  let results_per_test = new Map;

  let single_test = query("test");

  set_status("Loading manifest");

  fetch("perf-reftest.list", { cache: "no-cache" })
    .catch(ex => { throw `Failed to load manifest: ${ex}.  Your browser might need to run the perf-reftest harness from an http: or https: location.`; })
    .then(response => {
      if (!response.ok) {
        throw `Failed to load manifest: ${response.statusText}`;
      }
      return response.text();
    })
    .then(text => {
      let lines = text.split("\n").map(s => s.trim().replace(/#.*/, ""));
      let tests = [];
      lines.forEach((line, i) => {
        if (line != "") {
          let m = line.match(/^(<|==)\s+(\S+)\s+(\S+)$/);
          if (!m) {
            throw `Failed to load manifest: syntax error on line ${i + 1}`;
          }
          if (!single_test || m[2] == single_test) {
            tests.push([m[2], m[3], m[1]]);
          }
        }
      });
      return tests;
    })
    .then(tests => {
      let sequence = Promise.resolve();
      tests.forEach((t, i) => {
        sequence = sequence
          .then(() => {
            set_status(`Running test ${i + 1}/${tests.length} (test: ${t[0]})`);
            if (results_per_test.has(t[0])) {
              return results_per_test.get(t[0]);
            } else {
              return new Promise((resolve, reject) => {
                let id = setTimeout(() => window.report_perf_reftest_time({ type: "timeout" }), kTimeout);
                test_frame.src = t[0];
                window.report_perf_reftest_time = (test_result) => {
                  clearTimeout(id);
                  results_per_test.set(t[0], test_result);
                  resolve(test_result);
                }
              });
            }
          })
          .then((test_result) => {
            set_status(`Running test ${i + 1}/${tests.length} (ref: ${t[0]})`);
            if (results_per_test.has(t[1])) {
              return [test_result, results_per_test.get(t[1])];
            } else {
              return new Promise((resolve, reject) => {
                let id = setTimeout(() => window.report_perf_reftest_time({ type: "timeout" }), kTimeout);
                test_frame.src = t[1];
                window.report_perf_reftest_time = (ref_result) => {
                  clearTimeout(id);
                  results_per_test.set(t[1], ref_result);
                  resolve([test_result, ref_result]);
                };
              });
            }
          })
          .then(([test_result, ref_result]) => {
            reports.push({ test: t[0], ref: t[1], cmp: t[2], test_result: test_result, ref_result: ref_result });
          });
      });
      return sequence;
    })
    .then(() => {
      function make_failing(r, result) {
        if (result.type == "timeout") {
          r.status = "timeout";
          r.message = "Test file timed out";
          r.passed = false;
        } else if (result.type == "error") {
          r.status = "error";
          r.message = "Exception: " + result.value;
          r.passed = false;
        } else {
          throw `unknown result type "${result.type}"`;
        }
      }
      function make_row(element_name, class_name, cells) {
        let row = document.createElement("tr");
        row.className = class_name;
        cells.forEach(s => {
          let cell = document.createElement(element_name);
          if (typeof s == "object") {
            cell.appendChild(s)
          } else {
            cell.textContent = s;
          }
          row.appendChild(cell);
        });
        return row;
      }
      function format_time(result) {
        return result.type == "time" ? result.value.toFixed(2) + " ms" : "";
      }
      function esc(s) {
        var e = document.createElement("span");
        e.textContent = s;
        return e.innerHTML;
      }
      let report_table = document.createElement("table");
      report_table.id = "results";
      report_table.appendChild(make_row("th", "", ["Status", "Test", "Time (test)", "Time (ref)"]));
      let passing = 0;
      reports.forEach((r) => {
        if (r.test_result.type != "time") {
          make_failing(r, r.test_result);
        } else if (r.ref_result.type != "time") {
          make_failing(r, r.ref_result);
        } else {
          let passed;
          switch (r.cmp) {
            case "==":
              let longer, shorter;
              if (r.test_result.value > r.ref_result.value) {
                longer = r.test_result.value;
                shorter = r.ref_result.value;
              } else {
                longer = r.ref_result.value;
                shorter = r.test_result.value;
              }
              passed = (longer / shorter) < (1 + kEqualsTolerance) || longer < kEqualsMin;
              break;
            case "<":
              passed = r.test_result.value < r.ref_result.value * kLessThanTolerance;
              break;
          }
          if (passed) {
            r.status = "pass";
            r.message = "";
            r.passed = true;
            passing++;
          } else {
            r.status = "fail";
            r.message = "";
            r.passed = false;
          }
        }
        let message = document.createElement("span");
        message.innerHTML = `${r.cmp} <a href="${r.test}">${r.test}</a> <a href="${r.ref}">${r.ref}</a>\n${esc(r.message || "")}`;
        report_table.appendChild(make_row("td", r.passed ? "pass" : "fail", [r.status, message, format_time(r.test_result), format_time(r.ref_result)]));
      });
      set_status(`Finished: ${passing}/${reports.length} tests passed`);
      test_frame.remove();
      document.body.appendChild(report_table);
    })
    .catch(ex => set_status(ex));
};
