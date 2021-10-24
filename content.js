function banana() {
    console.log("banana");
}

var ZendeskUsername = "";
var ZendeskPassword = "";
var AdminLogin = "";
var AdminPassword = "";
var asanaTicketURL = "https://learninggenie.zendesk.com/api/v2/tickets/"; // default API URL for Zendesk
var cycles = 0; //prevents from endless looping over CCs

var MondayAPI_key = '';
var MandrillAPI_key = '';



//the HTML button and call for the function on clik
document.getElementById("c1").addEventListener("click", credentials);

document.getElementById("Settings").addEventListener("click", settings);

document.getElementById("Manual").addEventListener("click", manualSearch);


/** 
 * null checks the manual search feild and sets passwords and logins 
 */
function credentials() {

    chrome.storage.sync.get(["ZenLogin", "ZenPass", "LGpass", "LGlogin"], function(items) {

        //console.log(items);
        var error = false;

        if (items.ZenLogin != null) {

            ZendeskUsername = items.ZenLogin;

        } else {

            errorMessage("Zendesk Username is unavaliable");

            error = true;
        }

        if (items.ZenPass != null) {

            ZendeskPassword = items.ZenPass;

        } else {

            errorMessage("Zendesk Password is unavaliable");

            error = true;
        }

        if (items.LGpass != null) {

            AdminPassword = items.LGpass;

        } else {

            errorMessage("LG password is unavaliable");

            error = true;
        }

        if (items.LGlogin != null) {
            AdminLogin = items.LGlogin;

        } else {
            errorMessage("LG Username is unavaliable");
            error = true;
        }

        if (error) {
            return;
        } else {
            asanaGet();
        }
    });
}


async function Main(appendedURL) {


    loader(true);

    var zenEmails = await askZendesk(appendedURL, true); //calling Zendesk and passing the current URL

    var email = zenEmails.email;

    var cc_email = zenEmails.cc_email;

    var LG_data = await askLearningGenie(email, cc_email);

    var schoolName = LG_data.schoolName;

    await askMandrill(email);

    await askMonday(schoolName, email);

    analytics();

    loader(false);


}


/**
 * Sends a request to Monday and looks for a match of the agency 
 * owner email with the given email.
 * @param {*} schoolName the name of the School to look up
 * @param {*} email te email to compare to.
 * @returns agency owner email of the given school.
 */
async function askMonday(schoolName, email) {

    console.log("[Debug]: " + schoolName);

    var agency_id = 0;

    var query_for_id = "query {boards (ids: 662121139) {items { id name}}}"


    var response1 = await fetch("https://api.monday.com/v2/", {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': MondayAPI_key,
        },
        body: JSON.stringify({
            'query': query_for_id
        })

    });

    var data = await response1.json();

    for (i = 0; i < data["data"]["boards"][0]["items"].length; i++) {
        if (schoolName != null) {
            if (schoolName.toLowerCase().indexOf(data["data"]["boards"][0]["items"][i]["name"].toLowerCase()) >= 0 || data["data"]["boards"][0]["items"][i]["name"].toLowerCase().toLowerCase().indexOf(schoolName.toLowerCase()) >= 0) {

                agency_id = data["data"]["boards"][0]["items"][i]["id"];

                //for email
                var query_for_email = "query { boards (ids: 662121139) { items (ids: " + agency_id + ") { column_values(ids: \"text4\") {value}}}}"

                var response2 = await fetch("https://api.monday.com/v2/", {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': MondayAPI_key,
                    },
                    body: JSON.stringify({
                        'query': query_for_email
                    })

                });

                var data = await response2.json();
                var agencyOwnerEmail = data["data"]["boards"][0]["items"][0]["column_values"][0]["value"].replaceAll("\"", "");

                if (agencyOwnerEmail != null && agencyOwnerEmail != email) {
                    document.getElementById("agency_owner").innerHTML = "Agency Owner: " + agencyOwnerEmail; // updating HTML element

                } else {
                    console.log("[Debug]: No match for A-Owner Email");
                }

                return agencyOwnerEmail;
            } else {
                console.log("[Debug]: No match - No agency found");
            }
        }
    }
}
/**
 * Gets the current tab and extracts the Zendesk ticket number. 
 * Calls Main and passes the ticket number and the URL to Zendesk API + that ticket. 
 */
function asanaGet() {

    //getting the current tab
    chrome.tabs.query({
            'active': true,
            'windowId': chrome.windows.WINDOW_ID_CURRENT
        },

        function(tabs) {
            clearOutput();

            getCurrentURL_Data = getCurrentURL(tabs[0].url); // saving the current URL

            Main(getCurrentURL_Data.appendedURL, getCurrentURL_Data.lastFive);
        });

    /**
     * Receives the raw tab data and strips the ticket number
     * appends it to the Zendesk API URL
     * @param {string} tab current CHrome tab
     * @returns  returns the default Zendesk ticket url + ticket number {for askZendesk()}
     */
    function getCurrentURL(tab) {

        var lastFive = tab.substr(tab.length - 5); // getting the ticket number from the URL

        var appendedURL = asanaTicketURL + lastFive; // creating an API link for a request

        //cheking for integer values only
        if (isNaN(lastFive)) {

            document.getElementById("ticket").innerHTML = "Invalid Ticket number";
            return;

        } else {
            document.getElementById("ticket").innerHTML = lastFive; // updating HTML element with the ticket number
            return {
                appendedURL,
                lastFive
            };
        }
    }
}


/** 
 * Generates a request to Zendesk API  
 * Threre are 2 calls, one for requester id and then, based on the id, asks for email assosiated with this id  
 * @param {string} appendedURL a Zendesk default ticket url + ticket number 
 */

async function askZendesk(appendedURL) {

    var headers = new Headers();

    headers.set('Authorization', 'Basic ' + btoa(ZendeskUsername + ":" + ZendeskPassword)); // auth header for Zendesk

    //console.log("Asking ZenU " + ZendeskUsername); // Debug

    var response1 = await fetch(appendedURL, {

        method: 'GET',

        headers: headers,

    }); // first request

    var json1 = await response1.json(); // converting first request to json

    //console.log(json1); // Debug

    //checking for undefined/NULLs in the resopnse form Zendesk [Requester ID - First Request]
    switch (json1["error"]) {

        case "Couldn\'t authenticate you":

            errorMessage("Couldn't authenticate - Zendesk");

            return;

        case "RecordNotFound":

            document.getElementById("email").innerHTML = "Unable to find this email";

            return;


        case undefined:

            var req_id = await json1["ticket"]["requester_id"] // getting the id

            var cc_ids = await json1["ticket"]["collaborator_ids"] // getting the id

            //check if there are any CCs
            //if so, save the first one
            if (cc_ids.length != 0) {

                var cc_email = await ZendeskSecondCall(cc_ids[0]);

            }


            var response2 = await fetch("https://learninggenie.zendesk.com/api/v2/users/" + req_id, {

                method: 'GET',

                headers: headers,

            }); // second request

            var json2 = await response2.json(); // converting second request to json

            var email = await json2["user"]["email"] // getting user email

            //console.log("[Debug]: " + json2); // Debug

            document.getElementById("email").innerHTML = email; // updating HTML element

            // return values
            return {
                email,
                cc_email
            };
    }
}

/**
 * Sends basic user analytics to a custom API. (Just increments the value in the DB unser a username)
 */
async function analytics() {

    await fetch("http://your.api.here.com/user/update?auth=supersecretpassword&username=" + ZendeskUsername + "&used=1");

}


/**  
 * 
 * @param {int} req_id a requester id 
 * @returns email assosiated on Zendesk with that id
 */
async function ZendeskSecondCall(req_id) {

    var headers = new Headers();

    var response2 = await fetch("https://learninggenie.zendesk.com/api/v2/users/" + req_id, {

        method: 'GET',

        headers: headers,

    }); // second request

    var json2 = await response2.json(); // converting second request to json

    var email = await json2["user"]["email"] // getting user email

    return email;

}

/**
 * Generates a request to LG with the given link and the object of interest. Takes care of the auth.
 * @param {*} link any link to LG api
 * @param {*} objectOfInterest the thing to append to the link
 * @returns the response form LG
 */
async function LearningGenieRequest(link, objectOfInterest) {

    var headers = new Headers();

    headers.set('Authorization', 'Basic ' + btoa(AdminLogin + ":" + AdminPassword)); // auth header for Learning Genie

    var response = await fetch(link + objectOfInterest, {

        method: 'GET',
        headers: headers,

    });

    return response

}


/**
 * Generates a request to Learning Genie API 
 * gets Activity ID, role and school name
 * updates HTML elements
 * @param {string}email an email that will be sent to the LG in the request  
 * @param {string}cc_email secondary email that will be tried if the first one fails
 * @returns LG activity ID, School name and role of the given email
 */

async function askLearningGenie(email, cc_email) {

    //check for looping
    if (cycles > 1) {
        return;
    }

    var response3 = await LearningGenieRequest("http://admin.learning-genie.com/admin/api/allOwners?page=1&size=10&order=asc&key=", email); // Activity ID request


    //console.log(response3); //Debug 
    if (response3["url"] == "http://admin.learning-genie.com/login") {

        errorMessage("Please keep Admin Portal Tab Open");

        return;

    } else {

        var json3 = await response3.json(); // converting the reposnse to the json

        console.log("[Debug]: " + json3); //Debug 

        //console.log(cc_email); //Debug 
        //console.log(cc_email.length); //Debug 

        //checking for no results
        if (json3["paging"]["totalPageElements"] == 0) {

            document.getElementById("id").innerHTML = "No matching records found";


            if (cc_email != null) {

                document.getElementById("errors").innerHTML = "Trying CCs";

                document.getElementById("email").innerHTML = cc_email; // updating HTML element

                cycles++;

                await askLearningGenie(cc_email);
            }

            document.getElementById("errors").innerHTML = "";
            loader(false);

            return;

            // cjecking for multiple results
        } else if (json3["paging"]["totalPageElements"] >= 1) {

            //console.log(json3["data"]["length"]); //Debug
            var trueEntryNumber = -1;

            for (i = 0; i < json3["data"]["length"]; i++) {

                if (json3["data"][i]["remove"] == false) {
                    trueEntryNumber = i
                    console.log("True Entry: " + trueEntryNumber); //Debug
                }
            }

            if (trueEntryNumber != -1) {

                document.getElementById("email_status").innerHTML = "Email:" + '<w class="green"> [Active]</w>';

                var LG_acivity_ID = await json3["data"][trueEntryNumber]["id"] // getting the Activity ID from the response

                var LG_Role = await json3["data"][trueEntryNumber]["role"];

                var schoolName = await json3["data"][trueEntryNumber]["centersName"][0];



                document.getElementById("id").innerHTML = LG_acivity_ID; // updating HTML element

                document.getElementById("role").innerHTML = "Role: " + LG_Role.replace(/_/g, " ");;

                document.getElementById("errors").innerHTML = "More than one match Found"; // updating HTML element with a woarning

                return {
                    LG_acivity_ID,
                    LG_Role,
                    schoolName
                };

            } else {

                var LG_acivity_ID = await json3["data"][0]["id"] // getting the Activity ID from the response

                var LG_Role = await json3["data"][0]["role"];

                var schoolName = await json3["data"][0]["centersName"][0];


                document.getElementById("email_status").innerHTML = "Email:" + '<w class="red"> [Removed]</w>';

                document.getElementById("id").innerHTML = LG_acivity_ID; // updating HTML element

                document.getElementById("role").innerHTML = "Role: " + LG_Role.replace(/_/g, " ");;

                document.getElementById("errors").innerHTML = "More than one match Found"; // updating HTML element with a woarning
                return {
                    LG_acivity_ID,
                    LG_Role,
                    schoolName
                };
            }



        } else {

            var LG_acivity_ID = await json3["data"][0]["id"] // getting the Activity ID from the response

            var LG_Role = await json3["data"][0]["role"];

            var schoolName = await json3["data"][i]["centersName"][0];

            if (json3["data"][0]["centersName"][0] != null) {
                var schoolName = json3["data"][0]["centersName"][0]
            }



            document.getElementById("id").innerHTML = LG_acivity_ID;

            document.getElementById("role").innerHTML = "Role: " + LG_Role.replace(/_/g, " ");;

            document.getElementById("errors").innerHTML = "Hint: When pasting, use CTRL + shift + V"; // updating HTML element


            return {
                LG_acivity_ID,
                LG_Role,
                schoolName
            };
        }
    }
}

/** 
 * Looks up the email status on Mandril
 * Updates HTML
 * @param {string} email an email that will be sent to the Mandrill API  
 */
async function askMandrill(email) {

    document.getElementById("mndrl").innerHTML = ""; // updating HTML element with the email status

    var response_Mandrill = await fetch('https://mandrillapp.com/api/1.0/rejects/list', {
        method: 'POST',
        headers: {

            'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify({
            "key": MandrillAPI_key,
            "email": email,
            "include_expired": false,
            "subaccount": ""
        })
    });

    var json0 = await response_Mandrill.json(); // converting first request to json

    //console.log(json0); // Debug

    // Checking for errors
    //Mandrill returns an empty array if status is OK
    if (json0.length > 0) {
        document.getElementById("mndrl").innerHTML = "Mandrill Status: " + '<w class="red">' + json0['0']["reason"] + '</w>'; // updating HTML element + reason why email is bad
        return json0['0']["reason"];
    } else {
        document.getElementById("mndrl").innerHTML = "Mandrill Status:" + '<w class="green">' + " [OK]" + '</w>'; // updating HTML element
        return "OK";
    }
}

//OTHER


/**
 * Displays a given error for 2 seconds
 * @param {*} text error text
 */
function errorMessage(text) {

    document.getElementById("message-box").innerHTML = text;

    document.getElementById("message-box").style.display = "inline-block";

    setTimeout(() => {
        document.getElementById("message-box").style.display = "none";
    }, 2000);

}

/**
 * redirects to the settings page
 */
function settings() {

    location.href = "./login.html";

}


/**
 * Enables/Disables the loading symbol
 * @param {*} status true - to turn on | false - to turn off
 */
function loader(status) {
    if (status) {
        document.getElementById("loading").style.display = "block"; //loading symbol
    } else {
        document.getElementById("loading").style.display = "none"; //loading symbol
    }
}
/**
 * Clears the output area
 */
function clearOutput() {

    //Updating all of the HTML elements
    document.getElementById("ticket").innerHTML = "";

    document.getElementById("email").innerHTML = "";

    document.getElementById("id").innerHTML = "";

    document.getElementById("errors").innerHTML = "";

    document.getElementById("role").innerHTML = "";

    document.getElementById("mndrl").innerHTML = "";

}