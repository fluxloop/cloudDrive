/*jshint sub:true, eqeqeq:false, -W041*/

//Globals -- Must be reset in function resetApp()
var Basket = [];
var PaymentMethods = [];
var GlobalPaymentMethods = [];
var Giftcards = [];
var DiscountCodes = [];
var ComplaintCodes = [];
var lastOrderId = 0;
var lastPaymentCode = "";
var currentversion='3.0';

//Payment methods
var paymentMethodCash = "K";
var paymentMethodCard = "MB";
var paymentMethodGiftCard = "GA";
var paymentMethodInvoice = "F";
var paymentMethodLateDelivery = "SL";

// States
var screenLevel = 0; //Used to determine the back-button behavior
var isTouching = false; //Flag for whether or not the user is currently touching the screen
var ignoreClick = false; //Flag for when click-events should be ignored by underlying elements. Workaround for multiple click-events firing on overlapping elements.
var screenLocked = false;

//Urls
var localDriverOrdersUrl = "http://localhost/FetchDriverTotalOrder2.xml";
var localGiftCardUrl = "http://localhost:8080/giftcard.xml";
var phoneLocalDriverOrdersUrl = "svarer_27-02-2013.xml";
var fxlLogUrl = "http://fluxloop.com/peppes/log.php";


var peppesApiUrl = "https://www.peppes.no/peppesapi";
var peppesVersionUrl = "http://fluxloop.com/peppesversion.php?bust="+Math.floor(Math.random()*100);
var peppesDriverOrdersUrl = peppesApiUrl + "/FetchDriverTotalOrder";
var peppesEGCUrl = peppesApiUrl + "/AuthorizeGiftCard";
var peppesDeliveryOrderUrl = peppesApiUrl + "/DeliverDriverOrder";

//Settings
var desktopModePossible = true;
var desktopMode = false;
var offlineMode = false;
var debugmode = false;

//Activities
var activities = [];
activities['OrderDelivered'] = 'OrderDelivered';
activities['OrderDeliveredLate'] = 'OrderDeliveredLate';
activities['OrderReturned'] = 'OrderDeliveredReturned';
activities['AdvancedPaymentComplete'] = 'AdvancedPaymentComplete';
activities['AllItemsPicked'] = 'AllItemsPicked';
activities['LastOrderDelivered'] = 'LastOrderDelivered';
activities['Login'] = 'Login';
activities['AddGiftCard'] = 'AddGiftCard';
activities['NewGiftCardIssued'] = 'NewGiftCardIssued';
activities['OrderPaidByGiftCard'] = 'OrderPaidByGiftCard';
activities['arriveAtCustomer'] = 'arriveAtCustomer';
activities['error'] = 'error';

function init() {
    if( navigator.userAgent == "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36" ){
        if (desktopModePossible) {
            desktopMode = true;
            $("#desktopBackButton").show();
            $("#desktopSwap").show();
            alert('Desktop mode activated');
        }
    } else {
        document.addEventListener("backbutton", onBackKeyDown, false);
    }

    document.addEventListener("deviceready", onDeviceReady, false);
}

var debugOnCounter=0;
function debugOn(){
	//alert(debugOnCounter);
	debugOnCounter++;
	if(debugOnCounter==5){
	navigator.notification.confirm(
	    'Vil du aktivere debug? (Pizza blir ikke levert, men logget)', // message
	     onConfirmDebug, // callback to invoke with index of button pressed
	    'Debug', // title
	    'Ja,Nei' // buttonLabels
	);
	}
}

function onConfirmDebug(){
		peppesApiUrl = "http://fluxloop.com/debug.php";
		//peppesDriverOrdersUrl = "http://fluxloop.com/debug.php";
		peppesEGCUrl = "http://fluxloop.com/debug.php";
		peppesDeliveryOrderUrl = "http://fluxloop.com/debug.php";
}


function onDeviceReady(){
    /* start canvas*/
    clearCanvas();
    var canvas, context;

    // Initialization sequence.
    function initsign () {
        // Find the canvas element.
        canvas = document.getElementById('imageView');
        context = canvas.getContext('2d');

        // Attach the mousemove event handler.
        canvas.addEventListener('touchstart', ev_canvas, false);
        canvas.addEventListener('touchmove', ev_mousemove, false);
        canvas.addEventListener('touchend',   ev_canvas, false);
    }

    // The finger up or down event handler.
    var started = false;
    function ev_canvas (ev) {
        started = false;
    }

    // The finger move event handler
    function ev_mousemove (ev) {
        ev.preventDefault();
        var x, y;

        // Get the finger position relative to the canvas element.
        x = ev.touches[0].pageX;
        y = ev.touches[0].pageY;

        // Draw a line if started is true, or just move position to where the finger was last seen
        if (!started) {
            context.beginPath();
            context.moveTo((x), (y-50));
            started = true;
        } else {
            context.lineTo((x), (y-50));
            context.stroke();
        }
    }

    initsign();

    /* end canvas */
    checkForConnectionAtLoad();

    /* Version Check*/
    checkVersion();

    addTouchListener("calculator", onCalculatorClick);
    addTouchListener("padlock", onPadLockClick);
    addTouchListener("reset", onResetClick);

    if(desktopMode) {
        $("#calculator").click(onCalculatorClick);
        $("#reset").click(onResetClick);
        $("#padlock").click(onPadLockClick);
        
       
        
    }
}

function onBackKeyDown() {
    if (screenLevel == 0) {
        //Login screen
        var onConfirmExit = function(button) {
           if(button == 1) {
               exit();
           }
        };

        if (desktopMode) {
            onConfirmExit(1);
            return;
        }

        navigator.notification.confirm(
            'Vil du avslutte?', // message
             onConfirmExit, // callback to invoke with index of button pressed
            'Lukk applikasjon', // title
            'Ja,Nei' // buttonLabels
        );
    } else if (screenLevel == 1) {
        //Current screen: Product list. Go to Login
        resetApp();
    } else if (screenLevel == 2) {
        //Current screen: Destinations. Go to Product list
        hideDestinationsList();
        showProductList();
        screenLevel = 1;
    } else if (screenLevel == 3) {
        //Current screen: Destinations view. Go back to destination details
        hideDestinationsDetails();
        showDestinationsList();
        screenLevel = 2;
    } else if (screenLevel == 4) {
        //Payment screen
        var onConfirmCancelPayment = function(button) {
           if(button == 1) {
               hidePayment();
               showDestinationsDetails();
               screenLevel = 3;
           }
        };

        if (desktopMode) {
            onConfirmCancelPayment(1);
        }

        navigator.notification.confirm(
            'Avbryt betalingen?', // message
             onConfirmCancelPayment, // callback to invoke with index of button pressed
            'Betaling', // title
            'Ja,Nei' // buttonLabels;
        );
    } else if (screenLevel == 5) {
        alert('Kan ikke avbryte betalingen etter signering');
    } else if (screenLevel == 6) {
        //Hide add giftcard, show payment
        hideAddGiftCard();
        showPayment();
        screenLevel = 4;
    } else if (screenLevel == 7) {
        //Verify cell phone number
        hideVerifyCellPhone();
        showPayment();
        screenLevel = 4;
    } else if ( screenLevel == 8) {
        //Hide advanced payment, show payment
        hideAdvancedPayment();
        showPayment();
        if (Basket[lastOrderId]['paymentType'] == "credit") {
            screenLevel = 5;
        } else {
            screenLevel = 4;
        }
    } else if ( screenLevel == 9) {
        //Hide Signature. Show order details.
        hideSignature();
        showDestinationsDetails();
        screenLevel = 3;
    } else if (screenLevel == 10) {
        //Hide discount selection screen. Show advanced payment
        screenLevel = 8;
        hideDiscountSelection();
        showAdvancedPayment();
    } else if (screenLevel == 11) {
        //Hide complaint selection screen. Show advanced payment
        hideComplaintSelection();
        showAdvancedPayment();
        screenLevel = 8;
    } else if (screenLevel == 12) {
        hideComplaintOrderLineSelection();
        showComplaintSelection();
        screenLevel = 11;
    } else if(screenLevel == 13) {
        hideVerifyCellPhone();
        showAdvancedPayment();
        screenLevel = 8;
    }
}

/* Show and hide views */
function hideDiscountSelection() {
    $("#discountSelectionHeader").hide();
    $("#discountSelection").hide();
}

function hideSignature() {
    $("#sign").hide();
    $("#signButton"+lastOrderId).hide();
}

function hideAddGiftCard() {
    $("#addGiftCard" + lastOrderId).hide();
    $("#addGiftCard").hide();
}

function hideVerifyCellPhone() {
    $("#verifyCellPhone").hide();
    $("#verifyCellPhone" + lastOrderId).hide();
}

function showVerifyCellPhone() {
    $("#reset").hide();
    $("#calculator").hide();
    $("#verifyCellPhone").show();
    $("#verifyCellPhone" + lastOrderId).show();
}

function showDestinationInfo() {
    $('#tab2').removeClass('selected');
    $('#destinationItemList').hide();

    $('#tab1').addClass('selected');
    $('#destinationInfo').show();
}

function showDestinationItemList() {
    $('#tab1').removeClass('selected');
    $('#destinationInfo').hide();

    $('#tab2').addClass('selected');
    $('#destinationItemList').show();
}

function showDiscountSelection(code) {
    screenLevel = 10;
    lastPaymentCode = code;
    $("#calculator").hide();
    $("#reset").hide();
    $("#discountSelectionHeader").show();
    $("#discountSelection").show();
}

function showComplaintSelection(code) {
    screenLevel = 11;
    lastPaymentCode = code;
    $("#calculator").hide();
    $("#reset").hide();
    $("#complaintSelectionHeader").show();
    $("#complaintSelection").show();
}

function hideComplaintSelection(orderId) {
    if(!orderId) {
        orderId = lastOrderId;
    }

    $("#complaintSelectionHeader").hide();
    $("#complaintSelection").hide();

}

function showComplaintOrderLineSelection() {
    $("#complaintSelectionHeader").show();
    $("#complaintOrderLineSelection").show();
    $("#complaintOrderLineList" + lastOrderId).show();
}

function hideComplaintOrderLineSelection() {
    $("#complaintSelectionHeader").hide();
    $("#complaintOrderLineSelection").hide();
    $("#complaintOrderLineList" + lastOrderId).hide();
}

function hideDiscountSelection(orderId) {
    $("#discountSelectionHeader").hide();
    $("#discountSelection").hide();
}

function hideAdvancedPayment(orderId) {
    if (!orderId) {
        orderId = lastOrderId;
    }

    $("#reset").hide();
    $("#calculator").hide();
    $("#advancedPaymentHeader").hide();
    $("#advancedPayment").hide();
    $("#advancedPayment" + orderId).hide();
}

function showAdvancedPayment(orderId) {
    if (!orderId) {
        orderId = lastOrderId;
    }

    $("#advancedPaymentHeader").show();
    $("#advancedPayment").show();
    $("#advancedPayment" + orderId).show();
    $("#calculator").show();
    $("#reset").show();
}

function hideProductList() {
    $("#products").hide();
    $("#productHeader").hide();
    $("#padlock").hide();
}

function showProductList() {
    $("#products").show();
    $("#productHeader").show();
    $("#padlock").show();
}

function hideDestinationsDetails() {
    $("#destinationsDetailsHeader").hide();
    $("#destinations").hide();
}

function showDestinationsDetails() {
    $("#destinationsDetailsHeader").show();
    $("#destinations").show();
}

function hideDestinationsList() {
    $("#destinationsListHeader").hide();
    $("#destinationsList").hide();
}

function showDestinationsList() {
    $("#destinationsListHeader").show();
    $("#destinationsList").show();
}

function showPayment() {
    $("#calculator").show();
    $("#payment").show();
    $("#paymentHeader").show();
    $("#paymentDetails" + lastOrderId).show();
    $("#paymentSelection" + lastOrderId).show();
}

function hidePayment() {
    $("#paymentDetails" + lastOrderId).hide();
    $("#payment").hide();
    $("#paymentHeader").hide();
    $("#paymentSelection" + lastOrderId).hide();
    $("#calculator").hide();
}

function delayedExit() {
    window.setTimeout(exit, 500);
}

function exit() {
    navigator.app.exitApp();
}

function checkVersion() {
    $.ajax({
        type: "GET",
        url: peppesVersionUrl,
        dataType: "xml",
        success: function(xml) {
            // var versionstr = xml.xml ? xml.xml : (new XMLSerializer()).serializeToString(xml);
            var version = $(xml).children('version').text();

            if (version==currentversion) {
                  //version ok
            } else {
                alert("Ny versjon finnes: "+version+" ");
                $("#newVersion").show();
                            }
        },
        error: function() {
            alert("Se etter ny versjon feilet.");
        }
    });
}

function Log(activity,logdata) {
	
	/*if(!logdata){
		logdata="";
	}*/
	
    LogAppActivity(localStorage['userID'], lastOrderId, activity, logdata);
}

function LogAppActivity(employeeId, orderId, activity, logdata) {
			
            $.post( fxlLogUrl, { uid: employeeId, oid: orderId, act: activity, logdata: logdata })
              .done(function( data ) {
               
              });  
}





function checkForConnectionAtLoad() {
    var networkState = (navigator.network !== undefined) ? navigator.network.connection.type : "desktop";
    if( !networkState || networkState=="none" ){
        alert("Mangler kontakt med nettverket, laster siste tur lagret i mobilen.");
        localstorageLoad();
        $("#offline").show();
        $(".button.offline").hide();
        return 0;
    }

    return 1;
}

function checkForConnection(){
    var networkState = (navigator.network !== undefined) ? navigator.network.connection.type : "desktop";
    if( !networkState || networkState == "none" ){
        if( $('#offline').is(':hidden') ) {
            alert("Ojda. Mobilen er uten dekning.");
        }

        $("#offline").show();
        $(".button.offline").hide();
        return false;
    }

    return true;
}

function doLogin(){
    $("#loader").show();
    userpin = document.getElementById('pincode').value;

    $("#loginDiv").hide();
    $("#welcome").hide();
    $("#loader").show();
    loadXML(userpin);

    Log(activities['Login']);
}

//Fired when an item is being touched.
function onTouchStart(e) {
    if(isTouching){ return; }
    var item = e.currentTarget;
    e.currentTarget.moved = false;
    isTouching = true;
}

/**
 * Fired when the user moves his/her finger.
 * If we detect a move, we're not interested in the "tap" anymore
 * Always check for e.currentTarget.moved === true in *TouchEnd
 */
function onTouchMove(e) {
    e.currentTarget.moved = true;
}

function onGiftCardTouchEnd(e) {
    var title = e.currentTarget.title;
    var parts = title.split(";");
    var giftCardId = parts[0];
    var orderId = parts[1];
    giftCardClick(giftCardId, orderId);
}


function deliveryLateTouchEnd(e) {
    var orderId = e.currentTarget.title;
    if (orderId) {
        deliveryLateClick(orderId);
    }
}

function onListTouchEnd(e) {
    if (screenLocked && screenLevel == 1) {
        return;
    }

    var item = e.currentTarget;
    if( !$(item).hasClass("selected") ) {
        item.className = "selected";
        $("#products-total").html($("#products-total").html()-1);

        if ($("#products-total").html() == 0) {
            $("#productsDone").click(function () {

                if (screenLocked) {
                    return;
                }

                $("#products").hide();
                $("#productHeader").hide();
                $("#destinationsList").show();
                $("#destinationsListHeader").show();
                $("#padlock").hide();
                Log(activities['AllItemsPicked']);
                screenLevel = 2;
            });

            $("#productsDone").removeClass('disabled');
            $("#productsDone").addClass('enabled');
        }
    }

    if( $("#products-total").html() == "0") {
        $("#products-next").show();
        $("#products-status").hide();
    }
}

function onDestListTouchEnd(e) {
    if(ignoreClick) {
        return;
    }

    var orderId = $(e.currentTarget).attr("title");
    lastOrderId = orderId;


    clickDelay(300); //prevent double firing of click event
    viewCustomer(orderId);
    window.setTimeout(setGoogleMapLinks, 250);
}

function setGoogleMapLinks(orderId) {
    if (!orderId) {
        orderId = lastOrderId;
    }

    //Hack'n slash google maps link to support old versions of android (window.open doesn't do what we want).
    //Also prevent the anchor-tag to receive click-events when view is changed
    $("#" + orderId + "-mapaddr").attr('href', Basket[orderId]['googlemaps']);
    /*$("#" + orderId + "-mapimage").attr('href', Basket[orderId]['googlemaps']);*/
}

function onOfflineClick() {
    offlineMode = !offlineMode;
    triggerOfflineSwap();
}

function triggerOfflineSwap() {
    if (offlineMode) {
        alert("Mangler kontakt med nettverket, laster siste tur lagret i mobilen.");
        localstorageLoad();
        $("#offline").show();
        $(".button.offline").hide();
        return 0;
    }

    return 1;
}

function onTab1TouchEnd(e) {
    showDestinationInfo();
}

function onTab2TouchEnd(e) {
   showDestinationItemList();
}

function loadXML(employeeId){

    if(employeeId=="12345"){
        //TODO: Change URL
        //xmlURL = fxlDriverOrdersUrl + GetUnixTime();
        xmlURL = phoneLocalDriverOrdersUrl;
        if(desktopMode) {
            xmlURL = localDriverOrdersUrl;
        }

    } else {
        //add a random parameter to avoid hitting cache
        xmlURL = peppesDriverOrdersUrl + "?employeeId=" + employeeId + "&rnd=" + GetUnixTime();
    }

    $.ajax({
        type: "GET",
        url: xmlURL,
        dataType: "xml",
        success: function(xml) {
            var xmlstr = xml.xml ? xml.xml : (new XMLSerializer()).serializeToString(xml);
            localStorage['xml'] = xmlstr;
            localStorage['userID'] = employeeId;
            parseXML(xml);

        },

        error: function() {
            alert("Kunne ikke laste rute. Trolig server nedetid." + xmlURL);
            resetApp();
        }
    });
}

function parseXML(xml) {
    $(xml).find('error').each(function(){
        var errormessage = $(this).text();
        alert(errormessage);
    });

    var totalorders = $(xml).find('employee').find('orders').text();
    if (totalorders == 0) {
        alert("Fant ingen ordrer.");
        resetApp();
        document.getElementById('pincode').value = userpin;

        return;
    }

    screenLevel = 1;
    $("#padlock").show();
    $("#productHeader").show();
    var listItemCounter = 0;
    $(xml).find('group').each(function() {
        var groupName = $(this).attr("name");
        $("#productList").append("<div class='listheader'>" + groupName  + "</div>");
        var dummySerialNo = 100;
        $(this).find("item").each(function() {
            var listItemId = listItemCounter;
            listItemCounter++;
            var serialno = $(this).attr("serialno");
            var listItemText;

            if (serialno) {
                listItemText = "#" + Number(serialno);
            } else {
                serialno = dummySerialNo;
                dummySerialNo++;
                listItemText = Number($(this).attr("qty")) + " stk";
            }

            var placementHtml = "";
            var placement = $(this).attr("placement");
            if (placement) {
                placementHtml = "<span class=\"placement\">" + placement + "</span>";
            }
            
            if (groupName=="Pizza" && placement==""){
            	alert("OBS! "+$(this).text()+" "+serialno+" er enda ikke satt i hylle.");
            }

            $("#productList").append("<div class='listitem' style='line-height: inherit; height: inherit; position: relative;'><a id='" + groupName + "-" + serialno + "-" + listItemId + "'><strong>" + $(this).text() + "</strong><em>" + listItemText + "</em>" + placementHtml +"</a></div>");
        });
    });

    var links = document.querySelectorAll("#productList a"); //All the li items on this page
    $("#products-total").html(links.length);

    for(var i=0; i < links.length; ++i) {
        addTouchListener(links[i].id, onListTouchEnd);
    }

    if (desktopMode) {
        $("#products .listitem").click(
            function() {
                $("#products-total").html($("#products-total").html()-1);

                if ($("#products-total").html() == 0) {
                    $("#productsDone").click(function () {
                        $("#products").hide();
                        $("#productHeader").hide();
                        $("#padlock").hide();
                        $("#destinationsList").show();
                        $("#destinationsListHeader").show();
                        screenLevel = 2;
                    });

                    $("#productsDone").removeClass('disabled');
                    $("#productsDone").addClass('enabled');
                }
            }
        );
    }

    var discountCodeCount = 0;
    $(xml).find("discountCode").each(function() {
        var code = $(this).attr("code");
        var description = $(this).attr("description");
        DiscountCodes[discountCodeCount] = [];
        DiscountCodes[discountCodeCount]['code'] = code;
        DiscountCodes[discountCodeCount]['description'] = description;
        discountCodeCount++;
    });
    createDiscountCodeMarkup();

    var complaintCodeCount = 0;
    $(xml).find("complaintCode").each(function() {
        var code = $(this).attr("code");
        var description = $(this).attr("description");
        ComplaintCodes[complaintCodeCount] = [];
        ComplaintCodes[complaintCodeCount]['code'] = code;
        ComplaintCodes[complaintCodeCount]['description'] = description;
        complaintCodeCount++;
    });
    createComplaintCodeMarkup();

    $(xml).find('order').each(function() {
        var orderId = $(this).attr("id");
        var currentOrdertime = $(this).attr("timestamp");
        var orderTotal = Number($(this).attr("orderTotal"));
        var payment = $(this).attr("payment");
        var preorder = $(this).attr("preorder");
        var serialno = $(this).attr("serialno");
        var deliveryWithin = $(this).attr("deliveryWithin");
        var deviceWidth = $(window).width();
        var cellPhoneNumber = $(this).attr("orderphone");
        var orderDiscount = $(this).attr("orderDiscount");

        if (!orderDiscount) {
            orderDiscount = 0;
        } else {
            orderDiscount = Number(orderDiscount);
        }

        var customerAdr = $(this).find("streetname").text() + " "
            + $(this).find("streetnumber").text()
            + $(this).find("streetletter").text();

        var customerCity = $(this).find("city").text();

        if (preorder=="true") {
            $(".preorder").show();
            $("#destinationList .preorder").append("<div class='destinationListItem listitem' title='" + orderId + "' id='listItem" + orderId + "'></div>");
            $("#destinationList .preorder #listItem"+orderId).append("<a><strong>" + customerAdr + "</strong><em class=''>"+timeFromUnix(deliveryWithin)+"</em></a>");
        } else {
            $("#destinationList .normal").append("<div class='destinationListItem listitem' title='" + orderId + "' id='listItem" + orderId + "'></div>");
            $("#destinationList .normal #listItem"+orderId).append("<a><strong>" + customerAdr + "</strong><em class='timestamp' title='"+currentOrdertime+"'></em></a>");
        }

        addTouchListener("listItem" + orderId, onDestListTouchEnd);
        if(desktopMode) {
            if (preorder == "true") {
                $("#destinationList .preorder #listItem"+orderId).click(
                    function(e) {
                        viewCustomer(orderId);
                    });
            } else {
                $("#destinationList .normal #listItem"+orderId).click(
                    function(e) {
                        viewCustomer(orderId);
                    });
            }
        }

        Basket[orderId] = [];
        Basket[orderId]['baseOrderTotal'] = orderTotal;
        Basket[orderId]['baseOrderTotalRebate'] = (orderTotal / 2);
        Basket[orderId]['lateDelivery'] = 0;
        Basket[orderId]['orderDiscount'] = orderDiscount;
        Basket[orderId]['originalOrderTotal'] = orderTotal + orderDiscount; //Discount is already subtracted from order total. To get original value, add ordertotal and discount.
        Basket[orderId]['paymentType'] = payment;

        /* destination details */
        $("#destinationsDetails #destinationInfo").append("<div class='destinationsDetailsItem' style='display:none;' id='detailsItem" + orderId + "'></div>");
        var customerName = $(this).find("firstname").text() + " " + $(this).find("lastname").text();
        var customerPhone = $(this).find("phone").text();
        var customerInfo = $(this).find("info").text();
        var customerEmail = $(this).find("email").text();
        var emailList = "";
  
         $(this).find("email").each(function() {
        
         customerEmail = $(this).text();
         emailList = '<option value="'+customerEmail+'">'+customerEmail+'</option>'+emailList;
         
         });
	
		emailList = "<select style='width: 100%;' onChange='emailList(this," + orderId + ");'>"+emailList+"<option value=''>Ingen kvittering</option><select>";
		
		
        Basket[orderId]['emailAddress'] = customerEmail;

        $("#destinationsDetails #destinationInfo #detailsItem"+orderId)
            .append("<h2>" + customerName + "<em class='timestamp' title='"+currentOrdertime+"'></em></h2>")
            .append("<ul class='icon'></ul>");

        $("#destinationsDetails #destinationInfo #detailsItem" + orderId + " ul")
            .append("<li><img src='http://maps.googleapis.com/maps/api/staticmap?zoom=15&size="+deviceWidth+"x163&markers=size:large%7Ccolor:red%7C" + encodeURIComponent(customerAdr) + "," + (customerCity) + ",Norway&sensor=false'/></li>")
            .append("<li class='home'><a href='#' id='" + orderId + "-mapaddr' href='' class='mapsbutton'>" + customerAdr + "</a></li>")
            .append("<li class='call'><a href='tel:" + customerPhone + "' >" + customerPhone + "</a></li>");

        var googleMapsUrl = "http://maps.google.com/maps?f=q&source=s_q&hl=en&geocode=&q=" + encodeURIComponent(customerAdr) + "," + encodeURIComponent(customerCity) + "&aq=1&t=m&z=11&iwloc=A";
        //var geoUrl = "geo:0,0?q="  + encodeURIComponent(customerAdr) + "+" + encodeURIComponent(customerCity) + "&aq=1&t=m&z=11&iwloc=A";
        Basket[orderId]['googlemaps'] = googleMapsUrl;

        if (desktopMode) {
            setGoogleMapLinks(orderId);
        }

        $("#destinationsDetails #destinationInfo #detailsItem"+orderId)
            .append("<div class='info'><p>" + customerInfo + "</p></div>")
            .append("<div class='button' onclick='arriveAtCustomer();'><div>Fremme hos kunde</div></div>");

        /* Build the itemlist pr destination and complaint list */
        $("#destinationsDetails #destinationItemList").append("<div class='destinationsDetailsList' style='display:none;' id='detailsList" + orderId + "'></div>");
        $("#detailsList"+orderId).append("<h2>" + customerName + "<em class='timestamp' title='" + currentOrdertime + "'></em></h2>")
            .append("<ul><li>L&oslash;penummer #" + serialno + "</li></ul>");

        $("#complaintOrderLineSelection").append("<div class='complaintOrderLineList' style='display:none;' id='complaintOrderLineList" + orderId + "'></div>");
        var $complaintList = $("#complaintOrderLineList" + orderId);
        $complaintList.append("<div id='complaintOrderLineList" + orderId + "Title' class='listheader'></div>");

        $(this).find("orderline").each(function() {
            var orderLineLi;
            var price = Number($(this).attr("price"));
            if (price > 0) {
                var qty = Number($(this).attr("qty"));
                orderLineLi = "<li>" + qty + " stk " + $(this).text() + "<strong>&agrave; " + price + " kr</strong></li>";

                var orderLineNumber = $(this).attr("number");
                $complaintList.append("<div id=" + orderId + "-" + orderLineNumber + " class='listitem'><div class='tap' title='" + orderLineNumber + "'>" + $(this).text() + "</div></div>");
                addTouchListener(orderId + "-" + orderLineNumber, onComplaintOrderLineSelected);

                if (desktopMode) {
                    $("#" + orderId + "-" + orderLineNumber).click(function(e) {
                        onComplaintOrderLineSelected(e);
                    });
                }
            } else {
                orderLineLi = "<li><span style='color: red;'>" + $(this).text() + "<strong></span></strong></li>";
            }

            $("#destinationsDetails #destinationItemList #detailsList" + orderId + " ul").append(orderLineLi);
        });

        $complaintList.append("<div id='" + orderId + "-ComplaintOK' class='button'><div>Ok</div></div>");
        addTouchListener(orderId + "-ComplaintOK", completeComplaintOrderLineSelection);
        if (desktopMode) {
            $("#" + orderId + "-ComplaintOK").click(function(e) {
                completeComplaintOrderLineSelection();
            });
        }

        if (cellPhoneNumber) {
            Basket[orderId]['cellPhoneNumber'] = cellPhoneNumber;
        }

        /* Payment */
        PaymentMethods[orderId] = [];
        var paymentMethodCount = 0;
        $(this).find("paymentMethod").each(function() {
            PaymentMethods[orderId][paymentMethodCount] = [];
            var code = $(this).attr("code");
            var gratuityAllowed = $(this).attr("gratuityAllowed");
            var description = $(this).attr("description");
            var complaintCodeRequired = $(this).attr("complaintCodeRequired");
            var discountCodeRequired = $(this).attr("discountCodeRequired");

            PaymentMethods[orderId][paymentMethodCount]['code'] = code;
            PaymentMethods[orderId][paymentMethodCount]['gratuityAllowed'] = gratuityAllowed;
            PaymentMethods[orderId][paymentMethodCount]['description'] = description;
            PaymentMethods[orderId][paymentMethodCount]['complaintCodeRequired'] = complaintCodeRequired;
            PaymentMethods[orderId][paymentMethodCount]['discountCodeRequired'] = discountCodeRequired;

            if (!GlobalPaymentMethods[code]) {
                GlobalPaymentMethods[code] = [];
                GlobalPaymentMethods[code]['gratuityAllowed'] = gratuityAllowed;
                GlobalPaymentMethods[code]['description'] = description;
                GlobalPaymentMethods[code]['complaintCodeRequired'] = complaintCodeRequired;
                GlobalPaymentMethods[code]['discountCodeRequired'] = discountCodeRequired;
            }

            Basket[orderId][code] = 1;
            Basket[orderId][code + 'gratuityAllowed'] = gratuityAllowed;
            if (code == paymentMethodGiftCard) {
                Basket[orderId][code + 'gratuityAllowed'] = 'true';
                PaymentMethods[orderId]['gratuityAllowed'] = 'true';
            }

            paymentMethodCount++;
        });

        var sumPaymentListText = "<div class='sumList' id='sumPaymentList" + orderId + "'><ul></ul></div>";
        var sumDetailsListText = "<div class='sumDetailsList' id='sumDetailsList" + orderId + "'><ul></ul></div>";

        var egcPaymentListText = "<div class='egcList' id='egcPaymentList" + orderId + "'><ul></ul></div>";
        var egcDetailsListText = "<div class='egcDetailsList' id='egcDetailsList" + orderId + "'><ul></ul></div>";

        var grandTotalsPaymentListText = "<div class='grandTotalsList' id='grandTotalsPaymentList" + orderId + "'><ul></ul></div>";
        var grandTotalsDetailsListText = "<div class='grandTotalsDetailsList' id='grandTotalsDetailsList" + orderId + "'><ul></ul></div>";

        $("#detailsList"+orderId)
            .append(sumDetailsListText)
            .append(egcDetailsListText)
            .append(grandTotalsDetailsListText);

        $("#payment #totals").append("<div class='paymentDetailsList' style='display:none;' id='paymentDetails" + orderId + "'></div>");
        $("#payment #totals #paymentDetails" + orderId).append(sumPaymentListText)
            .append(egcPaymentListText)
            .append(grandTotalsPaymentListText);

        $("#payment #paymentButtons").append("<div style='display:none;' class='paymentSelection' id='paymentSelection" + orderId + "'></div>");

        var orderDiscountText = "";

        var subTotalStyle = "display: none";
        if (Basket[orderId]['orderDiscount'] > 0) {
            orderDiscountText = "<li style='color: green'>Avslag <strong>-" + Basket[orderId]['orderDiscount'] + " kr</strong></li>";
            subTotalStyle = "";
        }

        var subTotalPaymentText = "<li id='subTotalPayment" + orderId + "' style='" + subTotalStyle + "'>Subtotal <strong>" + Basket[orderId]['originalOrderTotal'] + " kr</strong></li>";
        var subTotalDetailsText = "<li id='subTotalDetails" + orderId + "' style='" + subTotalStyle + "'>Subtotal <strong>" + Basket[orderId]['originalOrderTotal'] + " kr</strong></li>";

        var grandTotalsDetailsText = "<li id='grandTotalsDetails" + orderId + "'>&Aring; betale <strong> " + Basket[orderId]['baseOrderTotal'] + " kr</strong></li>";
        var grandTotalsPaymentText = "<li id='grandTotalsPayment" + orderId + "'>&Aring; betale <strong> " + Basket[orderId]['baseOrderTotal'] + " kr</strong></li>";

        var grandTotalsRebatePaymentText = "<li style='display: none' id='discountPayment" + orderId + "' class='rebate'>Rabatt 50%<strong>-"
        + Basket[orderId]['baseOrderTotalRebate'] + " kr</strong></li>";

        var grandTotalsRebateDetailsText = "<li style='display: none' id='discountDetails" + orderId + "' class='rebate'>Rabatt 50%<strong>-"
        + Basket[orderId]['baseOrderTotalRebate'] + " kr</strong></li>";

        $("#sumDetailsList" + orderId + " ul")
            .append(subTotalDetailsText)
            .append(orderDiscountText);
        $("#grandTotalsDetailsList" + orderId + " ul")
            .append(grandTotalsRebateDetailsText)
            .append(grandTotalsDetailsText);

        $("#sumPaymentList" + orderId + " ul")
            .append(subTotalPaymentText)
            .append(orderDiscountText);
        $("#grandTotalsPaymentList" + orderId + " ul")
            .append(grandTotalsRebatePaymentText)
            .append(grandTotalsPaymentText);

        if (payment == "credit") {
            $("#detailsList"+orderId)
                .append("<div class='button sign offline' id='showSignButton" + orderId + "' onclick='sign(" + orderId + ");'><div>Signatur</div></div>");

            $("#signButtons")
                .append('<div class="button buttons2" id="signButton'+orderId+'" style="display:none" onClick="signSave(' + orderId + ')"><div>Lagre</div></div>');

            var emailText = "<div class='emailReceipt'><div>E-postkvittering:</div>"+emailList+"<input type='email' id='emailReceipt" + orderId + "' value='" + customerEmail + "' onchange='emailChanged(" + orderId + ", this.value)' onkeyup='emailChanged(" + orderId + ", this.value)' /></div>";

            var deliveryLateText = "<div class='deliveryLate'><div class='tap' title='" + orderId + "' id='deliveryLateItem" + orderId + "'>Forsinket levering (50% rabatt)</div></div>";
            if (desktopMode) {
                deliveryLateText = "<div class='deliveryLate'><div class='tap' title='" + orderId + "' id='deliveryLateItem" + orderId + "' onclick='deliveryLateClick(" + orderId + ")'>Forsinket levering (50% rabatt)</div></div>";
            }

			/* add all emails */

            $("#payment #paymentButtons #paymentSelection" + orderId)
                .append(deliveryLateText)
                .append("<div class='separator'>&nbsp;</div>")
                .append(emailText)
                .append("<div class='separator'>&nbsp;</div>")
                .append("<div class='button delivery offline' id='deliveryButton" + orderId + "' onclick='completePayment(" + orderId + ", -1);' style='display:none' ><div>Levert til kunde</div></div>");

            addTouchListener("deliveryLateItem" + orderId, deliveryLateTouchEnd);

            /* Advanced payment credit */
            createAdvancedPaymentMarkup(orderId);
        } else {
            Giftcards[orderId] = [];
            if ($(this).find("giftcard").size() > 0) {

                $("#sumPaymentList" + orderId + " ul")
                    .append(subTotalPaymentText);

                $("#grandTotalsPaymentList" + orderId + " ul")
                    .append(grandTotalsRebatePaymentText);

                //Always show when giftcards are present
                $("#subTotalPayment" + orderId).show();
                $("#subTotalDetails" + orderId).show();

                var cardCount = 0;
                $(this).find("giftcard").each(function() {
                    var giftCardId = $(this).attr("id");
                    var giftCardValue = Number($(this).attr("amount"));

                    $("#egcDetailsList" + orderId + " ul")
                        .append("<li id='detailsGiftCardItem" + giftCardId + "' class='giftCard enabled' >Gavekort - " + giftCardId + "<strong> -" + giftCardValue + " kr</strong></li>");

                    var ecgPaymentListItem = "<li id='paymentGiftCardItem" + giftCardId + "' class='giftCard enabled' title='" + giftCardId + ";" + orderId + "'><div class='tap'>Gavekort - " + giftCardId + "<strong> -" + giftCardValue + " kr</strong></div></li>";
                    if (desktopMode) {
                        ecgPaymentListItem = "<li id='paymentGiftCardItem" + giftCardId + "' class='giftCard enabled' title='" + giftCardId + ";" + orderId + "' onclick='giftCardClick(" + giftCardId + ","+ orderId + ")'><div class='tap'>Gavekort - " + giftCardId + "<strong> -" + giftCardValue + " kr</strong></div></li>";
                    }

                    $("#egcPaymentList" + orderId + " ul")
                        .append(ecgPaymentListItem);
                    addTouchListener('paymentGiftCardItem' + giftCardId, onGiftCardTouchEnd);

                    Giftcards[orderId][cardCount] = [];
                    Giftcards[orderId][cardCount]['id'] = giftCardId;
                    Giftcards[orderId][cardCount]['value'] = giftCardValue;
                    Giftcards[orderId][cardCount]['status'] = 1;
                    cardCount++;
                });
            } else {
                $("#payment #totals #paymentDetails" + orderId + " ul")
                    .append(grandTotalsRebatePaymentText);
            }

            $("#detailsList" + orderId)
                .append("<div class='button buttons2 offline' onclick='deliveryReturn(" + orderId + ");'><div>Retur </div></div>")
                .append("<div class='button buttons2 delivery offline' id='payButton" + orderId + "' onclick='beginPayment(" + orderId + ");'><div>Betal</div></div>");

            var emailText = "<div class='emailReceipt'><div>E-postkvittering:</div>"+emailList+"<input type='email' id='emailReceipt" + orderId + "' value='" + customerEmail + "' onchange='emailChanged(" + orderId + ", this.value)' onkeyup='emailChanged(" + orderId + ", this.value)' /></div>";

            var deliveryLateText = "<div class='deliveryLate'><div class='tap' title='" + orderId + "' id='deliveryLateItem" + orderId + "'>Forsinket levering (50% rabatt)</div></div>";
            if (desktopMode) {
                deliveryLateText = "<div class='deliveryLate'><div class='tap' title='" + orderId + "' id='deliveryLateItem" + orderId + "' onclick='deliveryLateClick(" + orderId + ")'>Forsinket levering (50% rabatt)</div></div>";
            }

            var cashButton = "<div class='button buttons2 delivery offline cash disabled' id='cashButton" + orderId + "'><div>Kontant</div></div>";
            if(Basket[orderId][paymentMethodCash]) {
                cashButton = "<div class='button buttons2 delivery offline cash' id='cashButton" + orderId + "' onclick='completePayment(" + orderId + ", 0);'><div>Kontant</div></div>";
            }

            var cardButton = "<div class='button buttons2 delivery offline card disabled' id='cardButton" + orderId + "'<div>Kort</div></div>";
            if (Basket[orderId][paymentMethodCard]) {
                cardButton = "<div class='button buttons2 delivery offline card' id='cardButton" + orderId + "' onclick='completePayment(" + orderId + ",1);'><div>Kort</div></div>";
            }

            var giftCardButton = "<div class='button buttons2 delivery offline cash' id='giftCardButton" + orderId + "' onclick='addGiftCardClick(" + orderId + ");' ><div>Gavekort</div></div>";
            var verifyCellPhoneButton = "<div class='button buttons2 delivery offline card' id='completeButton" + orderId + "' style='display: none' onclick='verifyCellPhoneNumber(" + orderId + ")'><div>Neste</div></div>";

            $("#payment #paymentButtons #paymentSelection" + orderId)
                .append(deliveryLateText)
                .append("<div class='separator'>&nbsp;</div>")
                .append(emailText)
                .append("<div class='separator'>&nbsp;</div>")
                .append(cashButton)
                .append(giftCardButton)
                .append(cardButton)
                .append(verifyCellPhoneButton);

            addTouchListener("deliveryLateItem"+orderId, deliveryLateTouchEnd);

            /* Verify cell phone */
            $("#verifyCellPhone").append("<div style='display: none' id='verifyCellPhone" + orderId + "'></div>");
            $("#verifyCellPhone" + orderId)
                .append("<label for='cellphone" + orderId + "'>Telefonnummer for gavekort:</label>")
                .append("<input class='paymentValue' type='number' name='cellPhoneNumber" + orderId + "' id='cellPhoneNumber" + orderId + "' value='" + Basket[orderId]['cellPhoneNumber'] + "'>")
                .append("<div class='button buttons2 partialPaymentCancel' onclick='cancelCellPhone(" + orderId + ")'><div>Avbryt</div></div>")
                .append("<div class='button buttons2 offline delivery partialPayment' onclick='completeCellPhone(" + orderId + ")'><div>Fullf&oslash;r</div></div>");

            /* Add gift card*/
            $("#addGiftCard").append("<div style='display: none' id='addGiftCard" + orderId + "'></div>");
            $("#addGiftCard" + orderId).append("<label for='addGiftCardNumber" + orderId + "'>Gavekortnummer:</label>")
                .append("<input class='paymentValue' type='number' name='addGiftCardNumber" + orderId + "' id='addGiftCardNumber" + orderId + "'>")
                .append("<div class='button buttons2 partialPaymentCancel' onclick='cancelAddGiftCard(" + orderId + ")'><div>Avbryt</div></div>")
                .append("<div class='button buttons2 offline delivery partialPayment' onclick='completeAddGiftCard(" + orderId + ")'><div>Legg til</div></div>");

            /* Advanced payment */
            createAdvancedPaymentMarkup(orderId);
        }

        calculateOrder(orderId);
    });

    addTouchListener("tab1", onTab1TouchEnd);
    addTouchListener("tab2", onTab2TouchEnd);
    initTimer();
    checkForConnectionTimer();
    $("#loader").hide();
    $("#products").show();
    $("#productsDone").show();
}

function createDiscountCodeMarkup() {
    for(var idx = 0; idx < DiscountCodes.length; idx++) {
        $("#discountSelection").append("<div class='listitem' id='" + idx + "-" + DiscountCodes[idx]['code'] + "'><strong>" + DiscountCodes[idx]['description'] + "</strong></div>");
        addTouchListener(idx + "-" + DiscountCodes[idx]['code'], onDiscountCodeSelected);
        if (desktopMode) {
            $("#" + idx + "-" + DiscountCodes[idx]['code']).click(function(e) {
                onDiscountCodeSelected(e);
            });
        }
    }
}

function onDiscountCodeSelected(e) {
    var id = e.currentTarget.id;
    var parts = id.split("-");
    var idx = parts[0];
    var discountText = "Rabattkode: <span name='" + DiscountCodes[idx]['code'] + "'>" + DiscountCodes[idx]['description'] + "</span>";
    var $discountLi = $("#" + lastPaymentCode + "-" +lastOrderId + "-discount");

    $discountLi.html(discountText);
    if (!$discountLi.hasClass('selected')) {
        $discountLi.addClass('selected');
    }

    if (!Basket[lastOrderId]['discounts']) {
        Basket[lastOrderId]['discounts'] = [];
    }

    Basket[lastOrderId]['discounts']['status'] = 1;
    Basket[lastOrderId]['discounts']['idx'] = idx;

    hideDiscountSelection();
    showAdvancedPayment();
    screenLevel = 8;
    clickDelay(300);
}

function onComplaintOrderLineSelected(e) {
    var id = e.currentTarget.id;
    var parts = id.split("-");
    var orderId = parts[0];
    var orderLine = parts[1];
    var $tapItem = $("#" + orderId + "-" + orderLine + " div");
    if ($tapItem.hasClass('selected')) {
        $tapItem.removeClass('selected');
    } else {
        $tapItem.addClass('selected');
    }

    clickDelay(300);
}

function completeComplaintOrderLineSelection(e) {
    var orderId = lastOrderId;
    var ampersand = '';
    var complaintOrderLineList = '';

    $("#complaintOrderLineList" + orderId + " .selected").each(function() {
        var number = $(this).attr('title');
        complaintOrderLineList += ampersand + "complaintOrderLine=" + number;
        ampersand = "&";
    });

    if (complaintOrderLineList === '') {
        alert('Velg minst en ordrelinje');
        return;
    }

    Basket[orderId]['complaintOrderLineList'] = complaintOrderLineList;
    hideComplaintOrderLineSelection();
    showAdvancedPayment();
    screenLevel = 8;
}

function createComplaintCodeMarkup() {
    for(var idx = 0; idx < ComplaintCodes.length; idx++) {
        $("#complaintSelection").append("<div class='listitem' id='" + idx + "-" + ComplaintCodes[idx]['code'] + "'><strong>" + ComplaintCodes[idx]['description'] + "</strong></div>");
        addTouchListener(idx + "-" + ComplaintCodes[idx]['code'], onComplaintCodeSelected);

        if (desktopMode) {
            $("#" + idx + "-" + ComplaintCodes[idx]['code']).click(function(e) {
                onComplaintCodeSelected(e);
            });
        }
    }
}

function onComplaintCodeSelected(e) {
    var id = e.currentTarget.id;
    var parts = id.split("-");
    var idx = parts[0];
    var complaintText = "Reklamasjonskode: <span name='" + ComplaintCodes[idx]['code'] + "'>" + ComplaintCodes[idx]['description'] + "</span>";
    var $complaintLi = $("#" + lastPaymentCode + "-" +lastOrderId + "-complaint");

    $complaintLi.html(complaintText);
    if (!$complaintLi.hasClass('selected')) {
        $complaintLi.addClass('selected');
    }

    if (!Basket[lastOrderId]['complaints']) {
        Basket[lastOrderId]['complaints'] = [];
    }

    Basket[lastOrderId]['complaints']['status'] = 1;
    Basket[lastOrderId]['complaints']['idx'] = idx;

    $("#complaintOrderLineList" + lastOrderId + "Title").html(ComplaintCodes[idx]['description'] + " gjelder for:");

    hideComplaintSelection();
    clickDelay(300);
    showComplaintOrderLineSelection();
    screenLevel = 12;
}

function createAdvancedPaymentMarkup(orderId) {
    $("#advancedPayment").append("<div style='display: none' class='advancedPayment' id='advancedPayment" + orderId + "'><ul></ul></div>");
    $("#advancedPayment" + orderId + " ul")
        .append("<li>Bel&oslash;p <em>" + Basket[orderId]['originalOrderTotal'] + "</em></li>");

    for(var idx = 0; idx < PaymentMethods[orderId].length; idx++) {
        var pm = PaymentMethods[orderId][idx];
        if (pm['code'] == paymentMethodGiftCard || pm['code'] == paymentMethodLateDelivery) {
            continue;
        }

        $("#advancedPayment" + orderId + " ul").append("<li id='" + pm['code'] + "-" + orderId + "-li'>" + pm['description'] + " <input id='" + pm['code'] + "-" + orderId + "' name='" + pm['code'] + "' class='payable' type='number' value=''/></li>");
        if (pm['discountCodeRequired'] == 'true') {
            $("#" + pm['code'] + "-" + orderId + "-li input").removeClass('payable').addClass('subtractable');
            var $advPaymentLi = $("#" + pm['code'] + "-" + orderId + "-li");
            $advPaymentLi.after("<li><div id='" + pm['code'] + "-" + orderId + "-discount' class='tap required disabled'>Rabattkode: <span>ingen valgt</span></div></li>");
            $advPaymentLi.focusout(function(e) {
                onDiscountValueChanged(e);
            });
        }

        if(pm['complaintCodeRequired'] == 'true') {
            $("#" + pm['code'] + "-" + orderId + "-li input").removeClass('payable').addClass('subtractable');
            var $advPaymentLi = $("#" + pm['code'] + "-" + orderId + "-li");
            $advPaymentLi.after("<li><div id='" + pm['code'] + "-" + orderId + "-complaint' class='tap required disabled'>Reklamasjonskode: <span>ingen valgt</span></div></li>");
            $advPaymentLi.focusout(function(e) {
                onComplaintValueChanged(e);
            });
        }
    }

    if (Giftcards[orderId]) {
        $("#advancedPayment" + orderId + " ul")
            .append("<li class='egcStart' id='egcStart" + orderId + "'>&nbsp;</li>");
        for(var i = 0; i < Giftcards[orderId].length; i++) {
            var egcStatus = Giftcards[orderId][i]['status'];
            var egcId = Giftcards[orderId][i]['id'];
            var egcValue = Giftcards[orderId][i]['value'];
            if (egcStatus) {
                $("#advancedPayment" + orderId + " ul")
                    .append("<li><div class='egc enabled' id='advancedPaymentGiftCardItem" + egcId + "'>EGK-" + egcId + "<input name='" + paymentMethodGiftCard + "' class='egc' type='number' disabled='disabled' value='" + egcValue + "'/></div></li>");
            } else {
                $("#advancedPayment" + orderId + " ul")
                    .append("<li><div class='egc' id='advancedPaymentGiftCardItem" + egcId + "'>EGK-" + egcId + "<input name='" + paymentMethodGiftCard + "' class='egc' type='number' disabled='disabled' value='" + egcValue + "'/></div></li>");
            }
        }
    }

     orderDiscountAdvancedPaymentText = "";
     if (Basket[orderId]['orderDiscount'] > 0) {
          orderDiscountAdvancedPaymentText = "<li style='color: green'>Avslag <em>-" + Basket[orderId]['orderDiscount'] + " kr</em></li>";
     }

     $("#advancedPayment" + orderId + " ul")
        .append(orderDiscountAdvancedPaymentText)
        .append("<li><div class='lateDelivery tap' id='lateDeliveryCheckbox" + orderId + "'>Forsinket levering (50% rabatt)<input type='number' class='lateDelivery' disabled='disabled' value='" + Basket[orderId]['baseOrderTotalRebate'] + "'/></div></li>")
        .append("<li id='advancedPaymentRemaining" + orderId + "' class='title'>Gjenst&aring;ende &aring; betale</li>")
        .append("<li id='advancedPaymentTip" + orderId + "' class='title'>Tips</li>");

    $("#advancedPayment" + orderId).append("<div id='advancedPaymentButtons" + orderId + "'></div>");
    $("#advancedPaymentButtons" + orderId)
        .append("<div id='cancelAdvancedPayment" + orderId + "' class='button buttons2 partialPaymentCancel' onclick='cancelAdvancedPayment(" + orderId + ")'><div>Avbryt</div></div>")
        .append("<div id='completeAdvancedPayment" + orderId + "' class='button buttons2 offline delivery partialPayment'  onclick='completeAdvancedPayment(" + orderId + ")'><div style='color: green;'>Fullf&oslash;r</div></div>")
        .append("<div id='newGiftCard" + orderId + "' style='display: none' class='button buttons2 offline delivery partialPayment'  onclick='verifyCellPhoneNumberAdvancedPayment(" + orderId + ")'><div style='color: green;'>Neste</div></div>");
    addTouchListener("lateDeliveryCheckbox"+orderId, onLateDeliveryCheckboxClicked);

    if (desktopMode) {
        $("#lateDeliveryCheckbox" + orderId).click(function(e) {
            onLateDeliveryCheckboxClicked(e);
        });
    }

    $("#advancedPayment" + orderId + " ul").focusout(function() {
        calculateAdvancedPayment();
    });
}

function onResetClick(e) {
     $("#advancedPayment" + lastOrderId + " ul li input").each(function() {
        if (!$(this).hasClass('lateDelivery') && !$(this).hasClass('egc')) {
            $(this).val('0');
            $(this).trigger('focusout');
        }
     });
     calculateAdvancedPayment();
}

function onDiscountValueChanged (e) {
    var parts = e.target.id.split("-");
    var code = parts[0];
    var orderId = parts[1];
    var $discountInput = $("#" + code + "-" + lastOrderId + "-li input");
    var $discountCodeLi = $("#" + code + "-" + lastOrderId + "-discount");

    if (Number($discountInput.val()) > 0) {
        if($discountCodeLi.hasClass('disabled')) {
            $discountCodeLi.removeClass('disabled');
            addTouchListener($discountCodeLi.attr('id'), onDiscountClick);

            if (desktopMode) {
                $discountCodeLi.click(function(e) {
                    onDiscountClick(e);
                });
            }
        }
    } else {
        $discountInput.val('0');
        if(!$discountCodeLi.hasClass('disabled')) {
            $discountCodeLi.addClass('disabled');

            if (desktopMode) {
                $discountCodeLi.click = null;
            }
        }
    }
}

function onDiscountClick(e) {
    var target = e.currentTarget;

    $listItem = $(target);
    if (!target.id) {
        $listItem = $listItem.parent();
    }

    var parts = $listItem.attr('id').split("-");
    var code = parts[0];
    var orderId = parts[1];
    hideAdvancedPayment(orderId);
    showDiscountSelection(code);
}

function onComplaintValueChanged (e) {
    var parts = e.target.id.split("-");
    var code = parts[0];
    var orderId = parts[1];
    var $complaintInput = $("#" + code + "-" + lastOrderId + "-li input");
    var $complaintCodeLi = $("#" + code + "-" + lastOrderId + "-complaint");

    if (Number($complaintInput.val()) > 0) {
        if($complaintCodeLi.hasClass('disabled')) {
            $complaintCodeLi.removeClass('disabled');
            addTouchListener($complaintCodeLi.attr('id'), onComplaintClick);

            if (desktopMode) {
                $complaintCodeLi.click(function(e) {
                    onComplaintClick(e);
                });
            }
        }
    } else {
        $complaintInput.val('0');
        if(!$complaintCodeLi.hasClass('disabled')) {
            $complaintCodeLi.addClass('disabled');

            if (desktopMode) {
                $complaintCodeLi.click = null;
            }
        }
    }
}

function onComplaintClick(e) {
    var target = e.currentTarget;

    $listItem = $(target);
    if (!target.id) {
        $listItem = $listItem.parent();
    }

    var parts = $listItem.attr('id').split("-");
    var code = parts[0];
    var orderId = parts[1];
    hideAdvancedPayment(orderId);
    showComplaintSelection(code);
}

function clickDelay(duration) {
    if (ignoreClick) {
        return;
    }

    if(!duration || duration < 0) {
        duration = 300;
    }

    ignoreClick = true;
    window.setTimeout(swapClick, duration);
}

function swapClick() {
    ignoreClick = !ignoreClick;
}

function cancelAdvancedPayment() {
    if(ignoreClick) {
        return;
    }

    onBackKeyDown();
}

function calculateGiftCardTotalValue(orderId) {
    var giftcardTotal = 0;
    if (Giftcards[orderId]) {
        for (var i = 0; i < Giftcards[orderId].length; i++) {
            if (Giftcards[orderId][i]['status'] == 1) {
                giftcardTotal += Number(Giftcards[orderId][i]['value']);
            }
        }
    }

    return giftcardTotal;
}

function calculateAdvancedPayment(orderId) {
    if(!orderId) {
        orderId = lastOrderId;
    }

    Basket[orderId]['paidByGiftCard'] = 0;
    Basket[orderId]['issueGiftCard'] = 0;

    var orderTotal = Number(Basket[orderId]['baseOrderTotal']);
    if (Basket[orderId]['lateDelivery'] == 1) {
        orderTotal = Number(Basket[orderId]['baseOrderTotalRebate']);
        $("#lateDeliveryCheckbox" + lastOrderId).addClass('selected');
    } else {
        $("#lateDeliveryCheckbox" + lastOrderId).removeClass('selected');
    }

    var totalPaidGratuityAllowed = 0;
    var totalPaidNoGratuity = 0;
    $("#advancedPayment" + orderId + " input.subtractable").each( function() {
        var amount = Number($(this).val());
        if (!amount) {
            return;
        }

        if (amount < 0) {
            amount = 0;
            $(this).val(amount);
            return;
        }

        var code = $(this).attr('name');
        if(Basket[orderId][code + 'gratuityAllowed'] == 'false') {
            if ((amount + totalPaidNoGratuity) > orderTotal) {
                var remaining = orderTotal - totalPaidNoGratuity;
                if (remaining < 0) {
                    remaining = 0;
                }

                var maxAmount = remaining;
                alert("Tips ikke tillat for '" + GlobalPaymentMethods[code]['description'] + "'. Reduserer til " + remaining);
                amount = maxAmount;
                $(this).val(amount);
                $(this).trigger('focusout');
            }

            totalPaidNoGratuity += amount;
        } else {
            totalPaidGratuityAllowed += amount;
        }

    });

    var giftCardTotalValue = calculateGiftCardTotalValue(orderId);
    if ( (giftCardTotalValue + totalPaidNoGratuity + totalPaidGratuityAllowed) >= orderTotal) {
        Basket[orderId]['paidByGiftCard'] = 1;
    } else {
        $("#advancedPayment" + orderId + " input.payable").each( function() {
            var amount = Number($(this).val());
            if (!amount) {
                return;
            }

            if (amount < 0) {
                amount = 0;
                $(this).val(amount);
                return;
            }

            var code = $(this).prop('name');
            if(Basket[orderId][code + 'gratuityAllowed'] == 'false') {
                if ((amount + totalPaidNoGratuity) > orderTotal) {
                    var remaining = orderTotal - totalPaidNoGratuity;
                    if (remaining < 0) {
                        remaining = 0;
                    }

                    var maxAmount = remaining;
                    alert("Tips ikke tillat for betalingsmetode '" + GlobalPaymentMethods[code]['description'] + "'. Reduserer til " + remaining);
                    amount = maxAmount;
                    $(this).val(amount);
                    $(this).trigger('focusout');
                }

                totalPaidNoGratuity += amount;
            } else {
                totalPaidGratuityAllowed += amount;
            }
        });
    }

    var totalPaid = totalPaidNoGratuity + totalPaidGratuityAllowed + giftCardTotalValue;
    if (Basket[orderId]['paidByGiftCard']) {
        if (totalPaid > orderTotal) {
            $("#advancedPaymentRemaining" + orderId).html("<span style='color: green;'>Restbel&oslash;p (nytt gavekort)</span><em style='color: green;'>" + (totalPaid - orderTotal)+ "</em>");
            $("#completeAdvancedPayment" + orderId).hide();
            $("#newGiftCard" + orderId).show();
            $("#advancedPayment" + orderId + " ul li input.payable").each( function() {
                $(this).attr('disabled', 'disabled');
                $(this).attr('value', '0');
            });
        } else {
            $("#advancedPaymentRemaining" + orderId).html("Gjenst&aring;ende &aring; betale <em style='color: green;'>0</em>");
            $("#newGiftCard" + orderId).hide();
            $("#completeAdvancedPayment" + orderId).show();
        }

        $("#advancedPaymentTip" + orderId).hide();
    } else {
        $("#advancedPaymentTip" + orderId).show();
        $("#completeAdvancedPayment" + orderId).show();
        $("#newGiftCard" + orderId).hide();
        $("#advancedPayment" + orderId + " ul li input.payable").each( function() {
            $(this).removeAttr('disabled');
        });

        var diff = orderTotal - totalPaid;
        var tips = 0;
        var remaining = 0;
        var color = "color: black";
        if (diff > 0) {
            remaining = diff;
            color = "color: red";
        } else if (diff < 0) {
            tips = -diff;
        }

        $("#advancedPaymentRemaining" + orderId).html("Gjenst&aring;ende &aring; betale <em style='" + color + "'>" + remaining + "</em>");
        $("#advancedPaymentTip" + orderId).html("Tips <em style='color: black;'>" + tips + "</em>");
    }
}

function emailList(that,orderId){
var selectedEmail = $(that).children(':selected').text();
if(selectedEmail=="Ingen kvittering"){selectedEmail="";}
$("#emailReceipt"+orderId).val(selectedEmail);
Basket[orderId]['emailAddress'] = selectedEmail;
}

function emailChanged(orderId, newEmail) {
    Basket[orderId]['emailAddress'] = newEmail;
}

function deliveryLateClick(orderId) {
    if (ignoreClick) {
        return;
    }

    if ($("#deliveryLateItem" + orderId).hasClass("selected")) {
        $("#deliveryLateItem" + orderId).removeClass("selected");
        $("#deliveryLateItem" + orderId).parent().removeClass("selected");
        $("#discountPayment" + orderId).css('text-decoration', 'line-through');
        $("#discountPayment" + orderId).css('color', '#999');
        $("#discountPayment" + orderId + " strong").css('text-decoration', 'line-through');
        $("#discountPayment" + orderId + " strong").css('color', '#999');
        $("#discountDetails" + orderId).hide();

        if(!Giftcards[orderId]) {
            $("#subTotalDetails" + orderId).hide();
        }

        Basket[orderId]['lateDelivery'] = 0;
        calculateOrder(orderId);
    } else {
        $("#deliveryLateItem" + orderId).addClass("selected");
        $("#deliveryLateItem" + orderId).parent().addClass("selected");
        $("#discountDetails" + orderId).show();
        $("#discountPayment" + orderId).show();
        $("#discountPayment" + orderId).css('text-decoration', 'none');
        $("#discountPayment" + orderId).css('color', 'green');
        $("#discountPayment" + orderId + " strong").css('text-decoration', 'none');
        $("#discountPayment" + orderId + " strong").css('color', 'green');
        $("#subTotalDetails" + orderId).show();
        $("#subTotalPayment" + orderId).show();

        Basket[orderId]['lateDelivery'] = 1;
        calculateOrder(orderId);
    }
}

function addGiftCardClick(orderId) {
    screenLevel = 6;
    $("#payment").hide();
    $("#addGiftCard").show();
    $("#addGiftCard" + orderId).show();

}

function completeAddGiftCard(orderId) {
    var giftCardId = $("#addGiftCardNumber" + orderId).val();
    var authEgcUrl = peppesEGCUrl + "?giftcardId=" + giftCardId + "&orderNo=" + orderId;
    if(desktopMode && localStorage['userID'] == '12345') {
        authEgcUrl = localGiftCardUrl;
    }

    $.ajax({
        type: "GET",
        url: authEgcUrl,
        dataType: "xml",
        success: function(xml) {
            processGiftCardReply(orderId, xml);
            Log(activities['AddGiftCard']);
        },
        error: function() {
            alert("Kunne ikke reservere gavekort " + giftCardId);
        }
    });
}

function processGiftCardReply(orderId, xml) {
    var xmlstr = xml.xml ? xml.xml : (new XMLSerializer()).serializeToString(xml);
    var giftCard = $(xml).find("giftcard");

    if(!giftCard) {
        alert(xmlstr);
        return;
    }

    var amount = $(giftCard).attr("amount");
    if (amount % 1 == 0) {
        amount = Number(amount);
    }

    var giftCardId = $(giftCard).attr("id");
    if (!giftCardId || !amount) {
        alert(xmlstr);
        return;
    }

    if (!Giftcards[orderId]) {
        Giftcards[orderId] = [];
    }

    $("#egcDetailsList" + orderId + " ul")
        .append("<li id='detailsGiftCardItem" + giftCardId + "' class='giftCard enabled' >Gavekort - " + giftCardId + "<strong> -" + amount + " kr</strong></li>");

    var giftCardListItem = "<li id='paymentGiftCardItem" + giftCardId + "' class='giftCard enabled' title='" + giftCardId + ";" + orderId + "'><div class='tap'>Gavekort - " + giftCardId + "<strong> -" + amount + " kr</strong></div></li>";
    if (desktopMode) {
        giftCardListItem = "<li id='paymentGiftCardItem" + giftCardId + "' class='giftCard enabled' title='" + giftCardId + ";" + orderId + "' onclick='giftCardClick(" + giftCardId + ","+ orderId + ")'><div class='tap'>Gavekort - " + giftCardId + "<strong> -" + amount + " kr</strong></div></li>";
    }

    $("#egcPaymentList" + orderId + " ul").append(giftCardListItem);
    addTouchListener('paymentGiftCardItem' + giftCardId, onGiftCardTouchEnd);

    $("#egcStart" + orderId).after("<li><div class='egc enabled' id='advancedPaymentGiftCardItem" + giftCardId + "'>EGK-" + giftCardId + " <input class='egc' type='number' disabled='disabled' value='" + amount + "'/></div></li>");

    var size = Giftcards[orderId].length;
    Giftcards[orderId][size] = [];
    Giftcards[orderId][size]['id'] = giftCardId;
    Giftcards[orderId][size]['value'] = amount;
    Giftcards[orderId][size]['status'] = 1;
    calculateOrder(orderId);
    $("#addGiftCardNumber" + orderId).val("");

    alert('Nytt gavekort ' + giftCardId + ' med saldo ' + amount + ' er lagt til');
    $("#addGiftCard" + orderId).hide();
    $("#addGiftCard").hide();
    $("#payment").show();
}

function cancelAddGiftCard(orderId) {
    $("#addGiftCard" + orderId).hide();
    $("#addGiftCard").hide();
    $("#payment").show();
}

function giftCardClick(giftCardId, orderId) {
    if($("#paymentGiftCardItem" + giftCardId).hasClass("enabled")) {
        $("#paymentGiftCardItem" + giftCardId).removeClass("enabled");
        $("#detailsGiftCardItem" + giftCardId).removeClass("enabled");
        $("#advancedPaymentGiftCardItem" + giftCardId).removeClass("enabled");
        setGiftCardStatus(giftCardId, orderId, 0);
    } else {
        $("#paymentGiftCardItem" + giftCardId).addClass("enabled");
        $("#detailsGiftCardItem" + giftCardId).addClass("enabled");
        $("#advancedPaymentGiftCardItem" + giftCardId).addClass("enabled");
        setGiftCardStatus(giftCardId, orderId, 1);
    }

    calculateOrder(orderId);
}

function setGiftCardStatus(giftCardId, orderId, statusCode) {
    for (var i = 0; i < Giftcards[orderId].length; i++) {
        if (Giftcards[orderId][i]['id'] == giftCardId) {
            Giftcards[orderId][i]['status'] = statusCode;
            break;
        }
    }
}

function calculateOrder(orderId) {
    //Reset basket properties
    Basket[orderId]['paidByGiftCard'] = 0;
    Basket[orderId]['issueGiftCard'] = 0;

    var grandTotals = Basket[orderId]['baseOrderTotal'];
    if (Basket[orderId]['lateDelivery'] == 1) {
        grandTotals = Basket[orderId]['baseOrderTotalRebate'];
    }

    if (Giftcards[orderId]) {
        for (var i = 0; i < Giftcards[orderId].length; i++) {
            if (Giftcards[orderId][i]['status'] == 1) {
                if (grandTotals - Giftcards[orderId][i]['value'] <= 0) {
                    Basket[orderId]['paidByGiftCard'] = 1;
                }

                grandTotals -= Number(Giftcards[orderId][i]['value']);
            }
        }
    }

    var grandTotalsText = "&Aring; betale <strong> " + grandTotals + " kr</strong>";
    if (Basket[orderId]['paidByGiftCard']) {
        if (grandTotals < 0) {
            grandTotalsText = "<span style='color: green'>Restbel&oslash;p (nytt gavekort) <strong> " + -(Math.round(grandTotals * 100) / 100) + " kr</strong><span>";
            Basket[orderId]['issueGiftCard'] = 1;
        }

        $("#cardButton" + orderId).hide();
        $("#giftCardButton" + orderId).hide();
        $("#cashButton" + orderId).hide();
        $("#completeButton" + orderId).show();
    } else {
        $("#completeButton" + orderId).hide();
        $("#giftCardButton" + orderId).show();
        $("#cashButton" + orderId).show();
        $("#cardButton" + orderId).show();
        if (screenLevel > 3) {
            $("#calculator").show();
        }
    }

    $("#grandTotalsPayment" + orderId).html(grandTotalsText);
    $("#grandTotalsDetails" + orderId).html(grandTotalsText);
}

function addTabTouchEventListeners(elementId) {
    addTouchListener(elementId, onTab1TouchEnd);
}

function tapDetected(e) {
    isTouching = false;
    if (e.currentTarget.moved === true) {
        delete e.currentTarget.moved;
        return false;
    }

    return true;
}

function addTouchListener(elementId, onTouchEndFunc) {
    if (!elementId) {
        alert('AddTouchListener: elementId is null!');
        return;
    }

    var touchable = document.getElementById(elementId);
    if (!touchable) {
        alert('AddTouchListener: ' + elementId + ' is null!');
        return;
    }

    touchable.addEventListener("touchstart", onTouchStart);
    touchable.addEventListener("touchmove", onTouchMove);
    var fn = onTouchEndFunc;

    touchable.addEventListener("touchend", function(e) {
        if (tapDetected(e) && !ignoreClick) {
            fn(e);
        }
    });
}

function beginPayment(orderId) {
    screenLevel = 4;
    hideDestinationsDetails();
    $(".paymentDetailsList").hide();
    $("#paymentHeader").show();
    $("#payment").show();
    $("#payment #totals #paymentDetails" + orderId).show();
    $("#payment #paymentButtons #paymentSelection" + orderId).show();
    $("#calculator").show();
}

function verifyCellPhoneNumber(orderId) {
    screenLevel = 7;
    $("#payment").hide();
    $("#payment #totals #paymentDetails" + orderId).hide();
    $("#payment #paymentButtons #paymentSelection" + orderId).hide();
    $("#verifyCellPhone").show();
    $("#verifyCellPhone" + orderId).show();
}

function verifyCellPhoneNumberAdvancedPayment(orderId) {
    var paymentError = false;
    $("#advancedPayment" + orderId + " input.subtractable").each( function() {
        var amount = Number($(this).val());
        if(amount <= 0) {
            return;
        }

        var code = $(this).prop('name');
        if (GlobalPaymentMethods[code]['discountCodeRequired'] == 'true') {
            var $discount = $("#" + code + "-" + orderId + "-discount span");
            var discountCode = $discount.attr('name');
            if (!discountCode) {
                alert('Rabattkode mangler for ' + GlobalPaymentMethods[code]['description']);
                paymentError = true;
                return;
            }
        }

        if(GlobalPaymentMethods[code]['complaintCodeRequired'] == 'true') {
            var $complaint = $("#" + code + "-" + orderId + "-complaint span");
            var complaintCode = $complaint.attr('name');
            if (!complaintCode) {
                alert('Reklamasjonskode mangler for ' + GlobalPaymentMethods[code]['description']);
                paymentError = true;
                return;
            }

            if(!Basket[orderId]['complaintOrderLineList']) {
                alert('Reklamasjon ufullstendig - mangler ordrelinjer');
                paymentError = true;
                return;
            }
        }
    });

    if (paymentError) {
        return;
    }

    screenLevel = 13;
    $("#advancedPayment" + orderId).hide();
    $("#reset").hide();
    $("#calculator").hide();
    showVerifyCellPhone();
}

function completeCellPhone(orderId) {
    var cellPhoneNumber = $("#cellPhoneNumber" + orderId).val();
    if (cellPhoneNumber && (cellPhoneNumber.length > 7 && cellPhoneNumber.length < 12)) {
        hideVerifyCellPhone();
        Basket[orderId]['cellPhoneNumber'] = cellPhoneNumber;
        if (screenLevel == 13) {
            //advanced payment
            completeAdvancedPayment(orderId);
        } else {
            completePayment(orderId, -1);
        }

        Log(activities['NewGiftCardIssued']);
    } else {
        alert('Telefonnummeret ' + cellPhoneNumber + ' er ikke gyldig.');
    }
}

function cancelCellPhone(orderId) {
    onBackKeyDown();
}

function completePayment(orderId, paymentType) {
    var urlParams = "";
    var orderTotal = Basket[orderId]['baseOrderTotal'];

    if (Basket[orderId]['lateDelivery'] == 1) {
        orderTotal = Basket[orderId]['baseOrderTotalRebate'];
        urlParams += "&lateDelivery=true";
    }

    var emailAddress = Basket[orderId]['emailAddress'];
    if (emailAddress && emailAddress.trim()) {
        urlParams += "&receiptEmail=" + emailAddress.trim();
    }

    if(Giftcards[orderId]) {
        var orderHasGiftCard = false;
        var giftCardNumbers = "";
        for (var i = 0; i < Giftcards[orderId].length; i++) {
            if (Giftcards[orderId][i]['status'] == 1) {
                orderTotal -= Giftcards[orderId][i]['value'];
                urlParams += "&giftcardId=" + Giftcards[orderId][i]['id'];
                orderHasGiftCard = true;
            }
        }

        if (orderHasGiftCard) {
            urlParams += "&cellPhoneNumber=" + Basket[orderId]['cellPhoneNumber'];
        }
    }

    if(!Basket[orderId]['paidByGiftCard']) {
        Basket[orderId]['totalPaid'] = orderTotal;
        if(paymentType == 0) {
            var decimals = orderTotal % 1;
            if (decimals >= 0.5) {
                orderTotal += (1 - decimals);
                //alert("Totalsum er rundet opp til " + orderTotal);
            } else {
                orderTotal -= decimals;
                //alert("Totalsum er rundet ned til " + orderTotal);
            }
            urlParams += "&paymentMethod=" + paymentMethodCash;
            urlParams += "&paymentAmount=" + orderTotal;

        }

        if (paymentType == 1) {
            urlParams += "&paymentMethod=" + paymentMethodCard;
            urlParams += "&paymentAmount=" + orderTotal;
        }
    } else {
        Log(activities['OrderPaidByGiftCard']);
        Basket[orderId]['totalPaid'] = 0;
    }

    completeDelivery(orderId, urlParams);
}

function completeAdvancedPayment(orderId) {
    if (ignoreClick) {
        return;
    }

    if (!orderId) {
        orderId = lastOrderId;
    }

    var urlParams = "";
    var orderTotal = Number(Basket[orderId]['baseOrderTotal']);
    if (Basket[orderId]['lateDelivery'] == 1) {
        orderTotal = Number(Basket[orderId]['baseOrderTotalRebate']);
        urlParams += "&lateDelivery=true";
    }

    var emailAddress = Basket[orderId]['emailAddress'];
    if (emailAddress && emailAddress.trim()) {
        urlParams += "&receiptEmail=" + emailAddress.trim();
    }

    var totalPaid = 0;
    if(Giftcards[orderId]) {
        var orderHasGiftCard = false;
        var giftCardNumbers = "";
        for (var i = 0; i < Giftcards[orderId].length; i++) {
            if (Giftcards[orderId][i]['status'] == 1) {
                orderTotal -= Giftcards[orderId][i]['value'];
                urlParams += "&giftcardId=" + Giftcards[orderId][i]['id'];
                orderHasGiftCard = true;
            }
        }

        if (orderHasGiftCard) {
            urlParams += "&cellPhoneNumber=" + Basket[orderId]['cellPhoneNumber'];
        }
    }

    var paymentError = false;
    $("#advancedPayment" + orderId + " input.subtractable").each( function() {
        var amount = Number($(this).val());
        if(amount <= 0) {
            return;
        }

        totalPaid += amount;
        var code = $(this).prop('name');
        urlParams += "&paymentMethod=" + code + "&paymentAmount=" + amount;

        if (GlobalPaymentMethods[code]['discountCodeRequired'] == 'true') {
            var $discount = $("#" + code + "-" + orderId + "-discount span");
            var discountCode = $discount.attr('name');
            if (!discountCode) {
                alert('Rabattkode mangler for ' + GlobalPaymentMethods[code]['description']);
                paymentError = true;
                return;
            }

            urlParams += "&discountCode=" + discountCode;
        }

        if(GlobalPaymentMethods[code]['complaintCodeRequired'] == 'true') {
            var $complaint = $("#" + code + "-" + orderId + "-complaint span");
            var complaintCode = $complaint.attr('name');
            if (!complaintCode) {
                alert('Reklamasjonskode mangler for ' + GlobalPaymentMethods[code]['description']);
                paymentError = true;
                return;
            }

            if(!Basket[orderId]['complaintOrderLineList']) {
                alert('Reklamasjon ufullstendig - mangler ordrelinjer');
                paymentError = true;
                return;
            }

            urlParams += "&complaintCode=" + complaintCode + "&" + Basket[orderId]['complaintOrderLineList'];
        }
    });

    if(!Basket[orderId]['paidByGiftCard']) {
        $("#advancedPayment" + orderId + " input.payable").each( function() {
            if(paymentError) {
                return;
            }

            var amount = Number($(this).val());
            if(amount <= 0) {
                return;
            }

            totalPaid += amount;
            var code = $(this).prop('name');
            urlParams += "&paymentMethod=" + code + "&paymentAmount=" + amount;
        });
    } else {
        orderTotal = totalPaid;
    }

    if (paymentError) {
        return;
    }

    var diff = orderTotal - totalPaid;
    if (diff > 0) {
        alert('Manko ' + diff + ' kr. Kan ikke levere ordre.');
        return;
    }

    Basket[orderId]['totalPaid'] = totalPaid;
    Basket[orderId]['gratuity'] = Number(-diff);
    completeDelivery(orderId, urlParams);
}

function completeDelivery(orderId, urlParams, tip) {
    var deliveryUrl = peppesDeliveryOrderUrl + "?employeeId=" + localStorage['userID'] + "&delivered=true";
    if (urlParams != null && urlParams.length > 0) {
        deliveryUrl += urlParams;
    }

    deliveryUrl += "&orderNo=" + orderId;

    if (Basket[orderId]['sign']) {
        var params = deliveryUrl.slice(deliveryUrl.indexOf("?") + 1, deliveryUrl.length);
        params += "&sign=" + Basket[orderId]['sign'];
               
        $.ajax({
            type: "POST",
            url: peppesDeliveryOrderUrl,
            dataType: "xml",
            data: params,
            success: function(xml) {
                var xmlstr = xml.xml ? xml.xml : (new XMLSerializer()).serializeToString(xml);
                if(xmlstr != "<result/>") {
                    alert(xmlstr);
                    Log(activities['error'],xmlstr);
                } else {
                 	//do nothing   
                }
            },

            error: function(e) {
                alert("Kunne ikke levere pizza.");
            }
        });
       
    } else {
        $.ajax({
            type: "GET",
            url: deliveryUrl,
            dataType: "xml",
            success: function(xml) {
                var xmlstr = xml.xml ? xml.xml : (new XMLSerializer()).serializeToString(xml);
                if(xmlstr != "<result/>") {
                    alert(xmlstr);
                    Log(activities['error'],xmlstr);
                } else {
                    //do nothing   
                }
            },
            error: function(e) {
                alert("Kunne ikke levere pizza.");
            }
        });
       
    }

    var deliveredHTML = $("#listItem"+orderId).html();
    $("#listItem"+orderId).remove();
    $("#destinationList .delivered").append("<div class='destinationListItem listitem' onClick='viewCustomer(" + orderId + ")' id='listItem" + orderId + "'></div>");
    $("#destinationList .delivered #listItem"+orderId).append(deliveredHTML);

    if (Basket[orderId]['lateDelivery']) {
        $("#destinationList .delivered #listItem" + orderId + " em").html("Forsinket!");
        Log(activities['OrderDeliveredLate'],deliveryUrl);
    } else {
        $("#destinationList .delivered #listItem" + orderId + " em").html("OK!");
        Log(activities['OrderDelivered'],deliveryUrl);
    }

    $("#destinationList .delivered #listItem" + orderId + " em").removeClass("timestamp");
    $("#detailsList" + orderId + " .button").hide();
    $("#detailsItem" + orderId + " .button").hide();
    $("#payButton" + orderId + " .button").hide();

    $("#grandTotalsDetails" + orderId).html("Betalt <strong>" + Number(Basket[orderId]['totalPaid']) + "</strong>");
    if (Basket[orderId]['gratuity'] > 0) {
        $("#grandTotalsDetailsList" + orderId + " ul").append("<li style='color: green'>Herav tips <strong> " + Number(Basket[orderId]['gratuity']) + "</strong></li>");
    }

    if (screenLevel == 8 || screenLevel == 13) {
        //Hide advanced payment
        hideAdvancedPayment();
    }

    backToList();
}

var deliveryReturn = function(orderID) {
    currentOID = orderID;
    var onConfirm = function(button) {
        if(button==1) {
            deliveryURL = peppesDeliveryOrderUrl + "?employeeId="+localStorage['userID']+"&delivered=true&postponeSettlement=true&orderNo="+currentOID;
            $.ajax({
                type: "GET",
                url: deliveryURL,
                dataType: "xml",
                success: function(xml) {
                    var xmlstr = xml.xml ? xml.xml : (new XMLSerializer()).serializeToString(xml);
                    if(xmlstr!="<result/>") {
                        alert(xmlstr);
                    }
                },
                error: function(){
                    alert("Kunne ikke levere pizza.");
                }
            });

            Log(activities['OrderReturned']);
            var deliveredHTML = $("#listItem"+currentOID).html();
            $("#listItem"+currentOID).remove();
            $("#destinationList .delivered").append("<div class='destinationListItem listitem' onClick='viewCustomer("+currentOID+")' id='listItem" + currentOID + "'></div>");
            $("#destinationList .delivered #listItem"+currentOID).append(deliveredHTML);
            $("#destinationList .delivered #listItem"+currentOID+" em").removeClass("timestamp");
            $("#destinationList .delivered #listItem"+currentOID+" em").html("Retur!");

            $("#detailsList"+currentOID+" .button").hide();
            $("#detailsItem"+currentOID+" .button").hide();

            backToList();
        }
    };

    if (desktopMode) {
        onConfirm(1);
        return;
    }

    navigator.notification.confirm(
        'Retunere orderen? ', //message
         onConfirm, //callback to invoke with index of button pressed
        'Levering', //title
        'Ja,Nei' //buttonLabels
    );
};

/* from list to details */
function viewCustomer(orderId){
    lastOrderId = orderId;
    $("#destinationsListHeader").hide();
    $("#destinationsList").hide();
    $(".destinationsDetailsItem").hide();
    $(".destinationsDetailsList").hide();

    $("#destinationsDetailsHeader").show();
    $("#destinations").show();
    $("#detailsItem"+orderId).show();
    $("#detailsList"+orderId).show();
    screenLevel = 3;
}

/* back to list from details */
function backToList(){
    $('#tab2').removeClass('selected');
    $("#destinationsDetailsHeader").hide();
    $("#destinations").hide();
    $("#destinationItemList").hide();
    $(".destinationsDetailsItem").hide();
    $(".destinationsDetailsList").hide();

    $('#tab1').addClass('selected');
    $("#destinationsListHeader").show();
    $("#destinationsList").show();
    $("#destinationInfo").show();
    $(".delivered").show();
    hidePayment();
    screenLevel = 2;
}

function arriveAtCustomer() {
	Log(activities['arriveAtCustomer']);
    showDestinationItemList();
}

function onCalculatorClick() {
    hidePayment();
    $("#calculator").show();
    $("#reset").show();
    calculateAdvancedPayment(lastOrderId);
    $("#advancedPaymentHeader").show();
    $("#advancedPayment").show();
    $("#advancedPayment" + lastOrderId).show();
    screenLevel = 8;
}

function onLateDeliveryCheckboxClicked(e) {
    if (Basket[lastOrderId]['lateDelivery'] == 0) {
        Basket[lastOrderId]['lateDelivery'] = 1;
        $("#lateDeliveryCheckbox" + lastOrderId).addClass('selected');
    } else {
        Basket[lastOrderId]['lateDelivery'] = 0;
        $("#lateDeliveryCheckbox" + lastOrderId).removeClass('selected');
    }

    deliveryLateClick(lastOrderId);
    calculateAdvancedPayment(lastOrderId);
}

function onPadLockClick() {
    if (screenLocked) {
        screenLocked = false;
        $("#padlock img").attr('src', 'img/padlock-open.png');
    } else {
        screenLocked = true;
        $("#padlock img").attr('src', 'img/padlock-closed.png');
    }
}

function initTimer() {
    timer();
    window.setInterval(timer, 1000);
}

function timer() {
    $('.timestamp').each(function(index) {
        $(this).html(timeAgo($(this).attr('title')));
    });
}

function GetUnixTime() {
    return parseInt(new Date().getTime());
}

// Time ago
function timeAgo(timestamp) {
    since = ((timestamp)- GetUnixTime()) / (60 * 60 * 24);
    since = Math.ceil(-since);

    if (since >= 50) {
        return "<span style='color: red;'>" + since + " min </span>";
    }

    return since + " min";
}

function timeFromUnix(timestamp) {
    var time = new Date(timestamp*1000);
    var hours = time.getHours();
    var mins = time.getMinutes();

    if(mins<=9) {
        mins = "0" + mins;
    }

    return hours + ":" + mins;
}

function disableAllLinks(){
    $('a[href*=#]').each(function() {
        event.preventDefault();
    });
}

function checkForConnectionTimer() {
    window.setInterval(checkForConnection, 10000);
}

function localstorageLoad() {
    resetApp(true);
    $("#loginDiv").hide();
    $("#welcome").hide();
    $("#loader").show();
    xml = localStorage['xml'];
    parseXML(xml);
}

function resetApp(supressConnectionCheck) {
    hideAll();
    $("#wrapper").html('<div id="loginDiv" style=""><input id="pincode" type="number" name="pincode" /><div class="button" onclick="doLogin();"><div> Login </div> </div> </div><div id="products" style="display:none;"><div class="list" id="productList"></div><div class="footer"><div class="button disabled" id="productsDone"><div> Varer igjen <span id="products-total">1</span> </div> </div> </div> </div><div id="destinationsList" style="display:none;"><div id="destinationList"><div class="normal"><div class="listheader"> Bestillinger </div> </div><div style="display:none;" class="preorder"><div class="listheader"> Forh&aring;ndsbestillinger </div> </div><div style="display:none;" class="delivered"><div class="listheader"> Levert </div> </div> </div> </div><div id="destinations" style="display:none;"><div class="tabs"><div class="tab selected" id="tab1" onclick="showDestinationInfo();"> Kunde </div><div class="tab" id="tab2" onclick="showDestinationItemList();"> Varer </div> </div><div id="destinationsDetails"><div id="destinationInfo"></div><div id="destinationItemList" style="display: none;"></div></div></div><div id="payment"><div id="totals"></div><div id="paymentButtons"></div></div><div id="addGiftCard" style="display: none"></div><div id="verifyCellPhone"></div><div id="advancedPayment"></div><div id="discountSelection" style="display: none"></div><div style="display: none;" id="complaintSelection"></div><div id="complaintOrderLineSelection" style="display: none"></div>');
    $("#loginDiv").show();
    $("#welcome").show();
    clearCanvas();

    //reset all globals
    Basket = [];
    Giftcards = [];
    DiscountCodes = [];
    ComplaintCodes = [];
    PaymentMethods = [];
    GlobalPaymentMethods = [];
    lastOrderId = 0;
    lastPaymentCode = '';
    screenLevel = 0;
    ignoreClick = false;
    screenLocked = false;
    $("#padlock img").attr('src', 'img/padlock-open.png');
    isTouching = false;
}

function hideAll() {
    $("#sign").hide();
    $("#padlock").hide();
    $("#reset").hide();
    $("#loader").hide();
    $("#products").hide();
    $("#calculator").hide();
    $("#destinationsList").hide();
    $("#destinationsListHeader").hide();
    $("#destinationsDetailsHeader").hide();
    $("#advancedPaymentHeader").hide();
    $("#productHeader").hide();
    $("#products").hide();
    hidePayment();
    hideDiscountSelection();
    hideComplaintSelection();
    hideComplaintOrderLineSelection();
}

function sign(orderId) {
    screenLevel = 9;
    $("#destinations").hide();
    $("#sign").show();
    $("#signButton" + orderId).show();
}

function clearCanvas() {



    canvas = document.getElementById('imageView');
    context = canvas.getContext('2d');
    context.fillStyle = "rgb(255,255,255)";
    context.fillRect (0, 0, 320, 340);
    context.fillStyle = "rgb(200,200,200)";
    context.fillRect (40, 4, 3, 332);
    

}

function signSave(orderId) {
    $("#saveSignInfo").show();
    saveImageData(orderId);
}

function saveImageData(orderId) {

    var currentOrderId = orderId;



    var canvas = document.getElementById('imageView');
	var signdata = canvas.toDataURL().substr(22);
	
	signdata = signdata.replace(/\+/g, '-');
	signdata = signdata.replace(/\//g, '_');
		
        if (signdata.length > 128) {
            Basket[currentOrderId]['sign'] = signdata;
            continueAfterSign(currentOrderId);
        } else {
              alert("Signatur feilet: ingen signatur? " + signdata);       
             }

     continueAfterSign(currentOrderId);
}

function continueAfterSign(orderId) {
    screenLevel = 5;
    clearCanvas();
    $("#sign").hide();
    $("#signButton"+orderId).hide();
    $("#showSignButton"+orderId).hide();
    $("#saveSignInfo").hide();
    $("#destinationsDetailsHeader").hide();

    $("#deliveryButton"+orderId).show();
    $("#deliveryLateItem"+orderId).show();
    $("#paymentHeader").show();
    $("#payment").show();
    $("#payment #totals #paymentDetails" + orderId).show();
    $("#payment #paymentButtons #paymentSelection" + orderId).show();
    $("#calculator").show();
}

function testConnection() {
    alert("Laster ruten fra server..");
    resetApp();

    var connected = 0;
    if (desktopMode) {
        connected = triggerOfflineSwap();
    } else {
        connected = checkForConnectionAtLoad();
    }

    if(connected) {
        $("#offline").hide();
        $("#loginDiv").hide();
        $("#welcome").hide();
        $("#productHeader").show();
        $("#loader").show();
        userpin = localStorage['userID'];
        loadXML(userpin);
    }
}

/* Debug output in app*/

if(debugmode==true){

$("#debug").show();

function debug() {

}

}

function getNewVersion(){
window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem){
fileSystem.root.getFile('download/PeppescloudDrive-debug.apk', {
    create: true, 
    exclusive: false
  }, function(fileEntry) {
  	var apkURL = "http://fluxloop.com/PeppescloudDrive-debug.apk";
    var localPath = fileEntry.fullPath,
    fileTransfer = new FileTransfer();        
    fileTransfer.download(apkURL, localPath, function(entry) {
        window.plugins.WebIntent.startActivity({
            action: window.plugins.WebIntent.ACTION_VIEW,
            url: 'file://' + entry.fullPath,
            type: 'application/vnd.android.package-archive'
            },
            function(){},
            function(e){
                alert('Error launching app update');
            }
        );                              

    }, function (error) {
        alert("Error downloading APK: " + error.code);
  });
  }, function(evt){
      alert("Error downloading apk: " + evt.target.error.code);                                               
  });
}, function(evt){
alert("Error preparing to download apk: " + evt.target.error.code);
});

}