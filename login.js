window.onload = function() {
    document.getElementById("Back").addEventListener("click", back);
    document.getElementById("Save").addEventListener("click", save);
    document.getElementById("Clear").addEventListener("click", clear);

    document.getElementById("show-pass").addEventListener("click", showPass);


    function showPass() {
        var LG = document.getElementById("LG-Pass");
        var Zen = document.getElementById("Zen-Pass");
        if (LG.type === "password") {
            LG.type = "text";
        } else {
            LG.type = "password";
        }

        if (Zen.type === "password") {
            Zen.type = "text";
        } else {
            Zen.type = "password";
        }
    }


    function clear() {
        chrome.storage.sync.clear(function() {
            var error = chrome.runtime.lastError;
            if (error) {
                console.error(error);
            } else {
                document.getElementById("message-box-2").style.display = "block";
                setTimeout(() => { document.getElementById("message-box-2").style.display = "none"; }, 2000);
            }
        });
    }



    function save() {

        var ZenLogin = document.getElementById("Zen-Login").value;

        var ZenPass = document.getElementById("Zen-Pass").value;

        var LGpass = document.getElementById("LG-Login").value;

        var LGlogin = document.getElementById("LG-Pass").value;


        if (ZenLogin != "") {
            chrome.storage.sync.set({ "ZenLogin": ZenLogin }, function() {});
        }
        if (ZenPass != "") {
            chrome.storage.sync.set({ "ZenPass": ZenPass }, function() {});
        }
        if (LGpass != "") {
            chrome.storage.sync.set({ "LGpass": LGpass }, function() {});
        }
        if (LGlogin != "") {
            chrome.storage.sync.set({ "LGlogin": LGlogin }, function() {});
        }
        document.getElementById("message-box").style.display = "block";

        setTimeout(() => { document.getElementById("message-box").style.display = "none"; }, 2000);

        document.getElementById("form").reset();

    }

    function back() {
        location.href = "./body.html";
    }
}