/*****************************************************************************
#                                                                            #
#    KVMD - The The main Pi-KVM daemon.                                      #
#                                                                            #
#    Copyright (C) 2018  Maxim Devaev <mdevaev@gmail.com>                    #
#                                                                            #
#    This program is free software: you can redistribute it and/or modify    #
#    it under the terms of the GNU General Public License as published by    #
#    the Free Software Foundation, either version 3 of the License, or       #
#    (at your option) any later version.                                     #
#                                                                            #
#    This program is distributed in the hope that it will be useful,         #
#    but WITHOUT ANY WARRANTY; without even the implied warranty of          #
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           #
#    GNU General Public License for more details.                            #
#                                                                            #
#    You should have received a copy of the GNU General Public License       #
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.  #
#                                                                            #
*****************************************************************************/


function Msd() {
	var self = this;

	/************************************************************************/

	var __state = null;
	var __upload_http = null;
	var __image_file = null;

	var __init__ = function() {
		$("msd-led").title = "Unknown state";

		$("msd-select-new-image-file").onchange = __selectNewImageFile;
		tools.setOnClick($("msd-select-new-image-button"), () => $("msd-select-new-image-file").click());

		tools.setOnClick($("msd-upload-new-image-button"), __clickUploadNewImageButton);
		tools.setOnClick($("msd-abort-uploading-button"), __clickAbortUploadingButton);

		tools.setOnClick($("msd-switch-to-kvm-button"), () => __clickSwitchButton("kvm"));
		tools.setOnClick($("msd-switch-to-server-button"), () => __clickSwitchButton("server"));

		tools.setOnClick($("msd-reset-button"), __clickResetButton);
	};

	/************************************************************************/

	self.setState = function(state) {
		__state = state;
		__applyState();
	};

	var __clickUploadNewImageButton = function() {
		var form_data = new FormData();
		form_data.append("image_name", __image_file.name);
		form_data.append("image_data", __image_file);

		__upload_http = new XMLHttpRequest();
		__upload_http.open("POST", "/kvmd/msd/write", true);
		__upload_http.upload.timeout = 5000;
		__upload_http.onreadystatechange = __uploadStateChange;
		__upload_http.upload.onprogress = __uploadProgress;
		__upload_http.send(form_data);
	};

	var __clickAbortUploadingButton = function() {
		__upload_http.onreadystatechange = null;
		__upload_http.upload.onprogress = null;
		__upload_http.abort();
		__upload_http = null;
		$("msd-progress").setAttribute("data-label", "Aborted");
		$("msd-progress-value").style.width = "0%";
	};

	var __clickSwitchButton = function(to) {
		var http = tools.makeRequest("POST", "/kvmd/msd/connect?to=" + to, function() {
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("Switch error:<br>", http.responseText);
				}
			}
			__applyState();
		});
		__applyState();
		wm.switchDisabled($(`msd-switch-to-${to}-button`), true);
	};

	var __selectNewImageFile = function() {
		var el_input = $("msd-select-new-image-file");
		var image_file = (el_input.files.length ? el_input.files[0] : null);
		if (image_file && image_file.size > __state.info.size) {
			wm.error("New image is too big for your Mass Storage Device.<br>Maximum:", __formatSize(__state.info.size));
			el_input.value = "";
			image_file = null;
		}
		__image_file = image_file;
		__applyState();
	};

	var __clickResetButton = function() {
		var http = tools.makeRequest("POST", "/kvmd/msd/reset", function() {
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("MSD reset error:<br>", http.responseText);
				}
			}
			__applyState();
		});
		__applyState();
	};

	var __applyState = function() {
		if (__state) {
			if (__state.connected_to === "server") {
				$("msd-another-another-user-uploads").style.display = "none";
				$("msd-led").className = "led-green";
				$("msd-status").innerHTML = $("msd-led").title = "Connected to Server";
			} else if (__state.busy) {
				if (!__upload_http) {
					$("msd-another-another-user-uploads").style.display = "block";
				}
				$("msd-led").className = "led-yellow-rotating-fast";
				$("msd-status").innerHTML = $("msd-led").title = "Uploading new image";
			} else {
				$("msd-another-another-user-uploads").style.display = "none";
				$("msd-led").className = "led-gray";
				if (__state.in_operate) {
					$("msd-status").innerHTML = $("msd-led").title = "Connected to KVM";
				} else {
					$("msd-status").innerHTML = $("msd-led").title = "Unavailable";
				}
			}

			$("msd-not-in-operate").style.display = (__state.in_operate ? "none" : "block");
			$("msd-current-image-broken").style.display = (
				__state.in_operate && __state.info.image &&
				!__state.info.image.complete && !__state.busy ? "block" : "none"
			);

			$("msd-current-image-name").innerHTML = (__state.in_operate && __state.info.image ? __state.info.image.name : "None");
			$("msd-current-image-size").innerHTML = (__state.in_operate && __state.info.image ? __formatSize(__state.info.image.size) : "None");
			$("msd-storage-size").innerHTML = (__state.in_operate ? __formatSize(__state.info.size) : "Unavailable");

			wm.switchDisabled($("msd-switch-to-kvm-button"), (!__state.in_operate || __state.connected_to === "kvm" || __state.busy));
			wm.switchDisabled($("msd-switch-to-server-button"), (!__state.in_operate || __state.connected_to === "server" || __state.busy));
			wm.switchDisabled($("msd-select-new-image-button"), (!__state.in_operate || __state.connected_to !== "kvm" || __state.busy || __upload_http));
			wm.switchDisabled($("msd-upload-new-image-button"), (!__state.in_operate || __state.connected_to !== "kvm" || __state.busy || !__image_file));
			wm.switchDisabled($("msd-abort-uploading-button"), (!__state.in_operate || !__upload_http));
			wm.switchDisabled($("msd-reset-button"), (!__state.in_operate || __upload_http));

			$("msd-new-image").style.display = (__image_file ? "block" : "none");
			$("msd-progress").setAttribute("data-label", "Waiting for upload ...");
			$("msd-progress-value").style.width = "0%";
			$("msd-new-image-name").innerHTML = (__image_file ? __image_file.name : "");
			$("msd-new-image-size").innerHTML = (__image_file ? __formatSize(__image_file.size) : "");

		} else {
			$("msd-another-another-user-uploads").style.display = "none";
			$("msd-led").className = "led-gray";
			$("msd-status").innerHTML = "";
			$("msd-led").title = "";
			$("msd-not-in-operate").style.display = "none";
			$("msd-current-image-broken").style.display = "none";
			$("msd-current-image-name").innerHTML = "";
			$("msd-current-image-size").innerHTML = "";
			$("msd-storage-size").innerHTML = "";

			wm.switchDisabled($("msd-switch-to-kvm-button"), true);
			wm.switchDisabled($("msd-switch-to-server-button"), true);
			wm.switchDisabled($("msd-select-new-image-button"), true);
			wm.switchDisabled($("msd-upload-new-image-button"), true);
			wm.switchDisabled($("msd-abort-uploading-button"), true);
			wm.switchDisabled($("msd-reset-button"), true);

			$("msd-select-new-image-file").value = "";
			$("msd-new-image").style.display = "none";
			$("msd-progress").setAttribute("data-label", "");
			$("msd-progress-value").style.width = "0%";
			$("msd-new-image-name").innerHTML = "";
			$("msd-new-image-size").innerHTML = "";
		}
	};

	var __formatSize = function(size) {
		if (size > 0) {
			var index = Math.floor( Math.log(size) / Math.log(1024) );
			return (size / Math.pow(1024, index)).toFixed(2) * 1 + " " + ["B", "kB", "MB", "GB", "TB"][index];
		} else {
			return 0;
		}
	};

	var __uploadStateChange = function() {
		if (__upload_http.readyState === 4) {
			if (__upload_http.status !== 200) {
				wm.error("Can't upload image to the Mass Storage Device:<br>", __upload_http.responseText);
			}
			$("msd-select-new-image-file").value = "";
			__image_file = null;
			__upload_http = null;
			__applyState();
		}
	};

	var __uploadProgress = function(event) {
		if(event.lengthComputable) {
			var percent = Math.round((event.loaded * 100) / event.total);
			$("msd-progress").setAttribute("data-label", percent + "%");
			$("msd-progress-value").style.width = percent + "%";
		}
	};

	__init__();
}
