var v; // video
var currentTr = null;
var subtitles = new Array();
var ctx = null; // time line canvas 2d context
var canvas = null; // time line canvas
var timeLineStart = 0.0;
var timeLineMoveStart = false;
var timeLineMoveEnd = false;
var timeLineMoveSub = 0.0;
var timeLineMoveIndex = -1;
var timeLineContextMenuIndex = -1;
var timeLineCenter = false;
var timeLineNewStart = -1.0;
var timeLineNewEnd = -1.0;
var timeLineIsMouseDown = false;
var sliderPos = null;
var sliderPosMoving = false;
var storage; // window.localStorage
var ctrlDown = false;

function paragraph(number, start, end, text) {
    this.number = number;
    this.start = start;
    this.end = end;
    this.duration = end - start;
    this.text = text;
}

function renumberSubtitlesInTable() {
    var trs = $("#subtitleTableBody tr");
    trs.each(function (i, n) {
        var current = $(n);
        var tds = $("td", current);
        tds.eq(0).html(i + 1);
    });
}

function secondsToSrtTimeShort(seconds) {
    var hours = new String(parseInt(seconds / 60 / 60));
    var minutes = new String(parseInt(seconds / 60 % 60));
    var s = new String(parseInt(seconds % 60));
    if (s.length == 1)
        s = "0" + s;
    if (hours == "0")
        return new String(minutes + ":" + s);
    return new String(hours + ":" + minutes + ":" + s);
}

function secondsToSrtTime(seconds) {
    var hours = new String(parseInt(seconds / 60 / 60));
    var minutes = new String(parseInt(seconds / 60 % 60));
    var s = new String(parseInt(seconds % 60));
    var milliseconds = new String(parseInt(seconds % 1 * 1000));
    if (minutes.length == 1)
        minutes = "0" + minutes;
    if (s.length == 1)
        s = "0" + s;
    while (milliseconds.length < 3)
        milliseconds = "0" + milliseconds;
    return new String(hours + ":" + minutes + ":" + s + "." + milliseconds);
}

function srtToSeconds(srt) {
    var arr = srt.split(":");
    var hours = arr[0];
    var minutes = arr[1];
    var seconds = arr[2].replace(',', '.');
    return parseFloat(hours) * 60 * 60 + parseFloat(minutes) * 60 + parseFloat(seconds);
}


function getSubTr(sub) {
    return '<tr><td class="subNumber">' + sub.number + '</td><td class="subStart">' + secondsToSrtTime(sub.start) + '</td><td class="subEnd">' + secondsToSrtTime(sub.end) + '</td><td class="subDuration">' + sub.duration.toFixed(3) + '</td><td class="subText">' + sub.text + '</td></tr>';
}

function getSubTds(sub) {
    return '<td class="subNumber">' + sub.number + '</td><td class="subStart">' + secondsToSrtTime(sub.start) + '</td><td class="subEnd">' + secondsToSrtTime(sub.end) + '</td><td class="subDuration">' + sub.duration.toFixed(3) + '</td><td class="subText">' + sub.text + '</td>';
}

function getParagraphFromTr(tr) {
    var tds = $("td", tr);
    if (tds.length > 0) {
        var number = tds.eq(0).html();
        var start = tds.eq(1).html();
        var end = tds.eq(2).html();
        var text = tds.eq(4).html();
        text = text.replace("\n", "<br>");
        return new paragraph(number, srtToSeconds(start), srtToSeconds(end), text);
    }
    return new paragraph(0, 0, 0, "empty");
}

function updateParagraphFromSub(index, sub) {
    var tr = $("#subtitleTable tr").eq(index);
    tr.html(getSubTds(sub));
}

function clearSubtitles() {
    subtitles = new Array();
    $("#subtitleTableBody").find("tr").remove();
}

function bindSubtitles() {
    $("#subtitleTableBody").find("tr").remove();        
    var len = subtitles.length;
    for (var i = 0; i < len; i++) {
        var sub = subtitles[i];
        sub.number = i + 1;
        if (i == 0)
            $('#subtitleTableBody').html(getSubTr(sub));
        else
            $('#subtitleTableBody tr:last').after(getSubTr(sub));
    }
}

function loadSubtitlesFromTable() {
    var trs = $("#subtitleTableBody tr");
    subtitles = new Array();
    trs.each(function (i, n) {
        var current = $(n);
        var p = getParagraphFromTr(current);
        subtitles.push(p);
    });
}

function failed(e) {
    // video playback failed - show a message saying why
    switch (e.target.error.code) {
        case e.target.error.MEDIA_ERR_ABORTED:
            alert('You aborted the video playback.');
            break;
        case e.target.error.MEDIA_ERR_NETWORK:
            alert('A network error caused the video download to fail part-way.');
            break;
        case e.target.error.MEDIA_ERR_DECODE:
            alert('The video playback was aborted due to a corruption problem or because the video used features your browser did not support.');
            break;
        case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            alert('The video could not be loaded, either because the server or network failed or because the format is not supported.');
            break;
        default:
            alert('An unknown error occurred during load of video.');
            break;
    }
}

function drawMultilineText(text, x, y, linespacing) {
    var textArr = new Array();
    text = text.replace(/\n\r?/g, '<br/>');
    text = text.replace('<br />', '<br/>');
    text = text.replace('<br>', '<br/>');
    textArr = text.split("<br/>");
    for (var i = 0; i < textArr.length; i++) {
        ctx.fillText(textArr[i], x, y);
        y += linespacing;
    }
}

function secondsToTimeLinePosition(seconds) {
    return Math.round(seconds * 100.0);
}

function timeLinePositiontoSeconds(xPosition) {
    return xPosition / 100.0;
}

function drawTimeLine(t) {
    if (ctx == null)
        return;

    var c = $(canvas);
    var w = c.width();
    var h = c.height();
    var subStartPos;
    var sub;
    var end;

    // draw black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    // draw grid
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)'; // line color
    for (var y = 0; y < h; y += 10) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    for (var x = 0; x < w; x += 10) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    ctx.stroke();

    // draw time line
    if (timeLineCenter) {
        timeLineStart = t - timeLinePositiontoSeconds((w / 2.0) - 25.0);
    }
    else {
        var maxTime = parseFloat(timeLineStart + timeLinePositiontoSeconds(w - 25));
        if (t < timeLineStart) {
            timeLineStart = t - 0.25;
        }
        else if (t > maxTime) {
            timeLineStart = t - 0.25;
        }
    }
    if (timeLineStart < 0)
        timeLineStart = 0.0;

    var secPos = Math.floor(timeLineStart);
    var pos = secondsToTimeLinePosition(Math.floor(secPos - timeLineStart));
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // line color
    ctx.fillStyle = "white";
    while ((pos - timeLineStart) < w) {
        secPos += 0.5;
        pos = secondsToTimeLinePosition(secPos - timeLineStart);
        ctx.moveTo(pos, h - 5);
        ctx.lineTo(pos, h);
        secPos += 0.5;
        pos = secondsToTimeLinePosition(secPos - timeLineStart);
        ctx.moveTo(pos, h - 10);
        ctx.lineTo(pos, h);
        ctx.fillText(secondsToSrtTimeShort(secPos), pos - 14, h - 20);
    }
    ctx.stroke();

    // draw subtitles
    end = timeLinePositiontoSeconds(secondsToTimeLinePosition(Math.floor(secPos - timeLineStart) + w));
    var len = subtitles.length;
    for (var i = 0; i < len; i++) {
        sub = subtitles[i];
        if (sub.end > timeLineStart && sub.start < end) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)' // paragraph color
            if (sub.start <= t && sub.end > t)
                ctx.fillStyle = 'rgba(255, 20, 20, 0.5)' // selected paragraph color
            subStartPos = secondsToTimeLinePosition(sub.start - timeLineStart);
            ctx.fillRect(subStartPos, 0, secondsToTimeLinePosition(sub.duration), h);
            //ctx.fillText(sub.number + "\n" + sub.text, subStartPos + 5, 10);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)' // paragraph color
            drawMultilineText("#" + sub.number + "\n" + sub.text, subStartPos + 5, 10, 10);
            //ctx.fillText(sub.text, subStartPos + 5, h-15);
        }
    }

    if (timeLineNewEnd >= 0 && timeLineNewStart >= 0 && Math.abs(timeLineNewStart - timeLineNewEnd) > 0.1) {
        var start = timeLineNewStart;
        end = timeLineNewEnd;
        if (start > end) {
            var temp = start;
            start = end;
            end = temp;
        }
        sub = new paragraph(0, start, end, "NEW");
        if (sub.end > timeLineStart && sub.start < end) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.5)' // paragraph color
            subStartPos = secondsToTimeLinePosition(sub.start - timeLineStart);
            ctx.fillRect(subStartPos, 0, secondsToTimeLinePosition(sub.duration), h);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)' // paragraph color
            //drawMultilineText("#" + sub.number + "\n" + sub.text, subStartPos + 5, 10, 10);
        }
    }

    // draw current video position
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(50, 255, 0, 0.6)' // video pos color (lime)
    var videoPos = secondsToTimeLinePosition(t - timeLineStart);
    ctx.moveTo(videoPos, 0);
    ctx.lineTo(videoPos, h);
    ctx.stroke();
}

function getTimeLineIndexFromPos(pos) {
    var seconds = timeLinePositiontoSeconds(pos) + timeLineStart;
    var len = subtitles.length;
    for (var i = 0; i < len; i++) {
        var sub = subtitles[i];
        if (sub.start <= seconds && sub.end > seconds) {
            return i;
        }
    }
    return -1;
}

function timeLineMouseOver(pos) {
    var seconds = timeLinePositiontoSeconds(pos) + timeLineStart;

    if (timeLineMoveIndex > -1) {
        if (timeLineMoveStart) {
            subtitles[timeLineMoveIndex].start = seconds;
            subtitles[timeLineMoveIndex].duration = subtitles[timeLineMoveIndex].end - subtitles[timeLineMoveIndex].start;
            updateParagraphFromSub(timeLineMoveIndex, subtitles[timeLineMoveIndex]);
        } else if (timeLineMoveEnd) {
            subtitles[timeLineMoveIndex].end = seconds;
            subtitles[timeLineMoveIndex].duration = subtitles[timeLineMoveIndex].end - subtitles[timeLineMoveIndex].start;
            updateParagraphFromSub(timeLineMoveIndex, subtitles[timeLineMoveIndex]);
        } else {
            subtitles[timeLineMoveIndex].start = seconds - timeLineMoveSub;
            subtitles[timeLineMoveIndex].end = subtitles[timeLineMoveIndex].start + subtitles[timeLineMoveIndex].duration;
            updateParagraphFromSub(timeLineMoveIndex, subtitles[timeLineMoveIndex]);
        }
        return;
    }

    var len = subtitles.length;
    for (var i = 0; i < len; i++) {
        var sub = subtitles[i];
        if (seconds + 0.05 > sub.start && seconds - 0.05 < sub.start) {
            return "col-resize"; // move start time
        } else if (seconds + 0.05 > sub.end && seconds - 0.05 < sub.end) {
            return "col-resize"; // move end time
        } else if (sub.start <= seconds && sub.end > seconds) {
            return "move"; // move whole paragraph
        }
    }
    return "default";
}

function timeLineMouseDown(e, pos) {
    var seconds = timeLinePositiontoSeconds(pos) + timeLineStart;
    var len = subtitles.length;
    if (e.which != 3) {
        timeLineNewStart = -1.0;
        timeLineNewEnd = -1.0;
    }
    for (var i = 0; i < len; i++) {
        var sub = subtitles[i];
        if (seconds + 0.05 > sub.start && seconds - 0.05 < sub.start) {
            timeLineMoveStart = true;
            timeLineMoveEnd = false;
            timeLineMoveIndex = i;
            return;
        } else if (seconds + 0.05 > sub.end && seconds - 0.05 < sub.end) {
            timeLineMoveStart = false;
            timeLineMoveEnd = true;
            timeLineMoveIndex = i;
            return;
        } else if (sub.start <= seconds && sub.end > seconds) {
            timeLineMoveStart = false;
            timeLineMoveEnd = false;
            timeLineMoveIndex = i;
            timeLineMoveSub = seconds - sub.start;
            return;
        }
    }
    if (e.which != 3) {
        timeLineNewStart = seconds;
        timeLineNewEnd = seconds;
    }
}

function updateSliderPosition(v, t) {
    if (sliderPosMoving)
        return;
    if (v.readyState < 1)
        return;

    var percent = t * 100.0 / v.duration;
    sliderPos.slider('value', percent);
}

function videoTime() {
    if (v.readyState < 1)
        return;
    var t = v.currentTime;
    $('#videoTime').text("Time: " + secondsToSrtTime(t));
    drawTimeLine(t);
    updateSliderPosition(v, t);
    var len = subtitles.length;
    for (var i = 0; i < len; i++) {
        var sub = subtitles[i];
        if (sub.start <= t && sub.end > t) {
            var old = $('#preview').html();
            if (old != sub.text) {
                $('#preview').html(sub.text);
            }
            return;
        }
    }
    $('#preview').html('');
}

function videoReady() {
    if (v.readyState >= 1) {
        $('#videoResolution').text("Resolution: " + v.videoWidth + "x" + v.videoHeight + ", duration: " + secondsToSrtTime(v.duration));
        $("#controlBarSliderVolume").slider('value', v.volume * 100.0);
        setInterval(videoTime, 10);
    } else {
        setTimeout(videoReady, 500);
    }
}

function listViewChange(tr, e) {
    $("#subtitleTableBody tr").removeClass("subSelected");
    currentTr = tr;
    if (tr.length == 0)
        return;

    var text = $("td:eq(4)", tr).html();
    text = text.replace("<br />", "\n");
    text = text.replace("<br>", "\n");
    text = text.replace("<br/>", "\n");
    $("#currentText").val(text);

    tr.addClass("subSelected");


    //TODO: auto scrolling
    var container = $('#tableContainer');
    var scrollTo = tr.prev();
    if (scrollTo.length > 0) {
//            var scrollValue = scrollTo.offset().top - container.offset().top + container.scrollTop();
//            if (scrollTo.offset().top + 20 > container.height())
        //                container.scrollTop(scrollValue + 300);
    }

}

function listViewContextMenuPopup(tr, e) {
    var x = e.pageX - 20;
    var y = e.pageY - 10;
    var dialog = $('#listviewContextMenu');
    dialog.css('position', 'absolute');
    dialog.css('left', x + "px");
    dialog.css('top', y + "px");
    dialog.show('fade');
}

function timeLineContextMenuPopup(e) {
    $(canvas).css('cursor', 'default');
    var x = e.pageX - 20;
    var y = e.pageY - 20;
    var pos = e.pageX - $(canvas).offset().left;
    timeLineContextMenuIndex = getTimeLineIndexFromPos(pos);

    if (timeLineContextMenuIndex != -1) {
        SelectListViewIndex(timeLineContextMenuIndex);
        $('#timeLineDelete').show();
        $('#timeLineInsertBefore').show();
        $('#timeLineInsertAfter').show();
        $('#timeLineMergeWithNext').show();
        $('#timeLineInsertHere').hide();
        showTimeLineContextMenu(x, y);
    }

    if (timeLineNewEnd >= 0 && timeLineNewStart >= 0 && Math.abs(timeLineNewStart - timeLineNewEnd) > 0.1) {
        var start = timeLineNewStart;
        var end = timeLineNewEnd;
        if (start > end) {
            var temp = start;
            start = end;
            end = temp;
        }
        var seconds = timeLinePositiontoSeconds(pos) + timeLineStart;
        if (end > seconds && start < seconds) {
            $('#timeLineDelete').hide();
            $('#timeLineInsertBefore').hide();
            $('#timeLineInsertAfter').hide();
            $('#timeLineMergeWithNext').hide();
            $('#timeLineInsertHere').show();
            showTimeLineContextMenu(x, y);
        }
    }
}

function showTimeLineContextMenu(x, y) {
    var dialog = $('#timeLineContextMenu');
    dialog.css('position', 'absolute');
    dialog.css('left', x + "px");
    dialog.css('top', y + "px");
    dialog.show('fade');
}

function currentTextChange() {
    if (currentTr == null)
        return;

    var text = $("#currentText").val();
    text = text.replace("\n", "<br>");
    $("td:eq(4)", currentTr).html(text);
    var idx = $("#subtitleTable tr").index(currentTr);
    var start = subtitles[idx].text = text;
}

function hideMsgBox() {
    $(".msgBoxText").hide();
    $('#backgroundFiller').hide();
}

function showFullscreenDialog(div) {
    $("#backgroundFiller").show();
    div.center();
    div.show();
    $('#backgroundFiller').die('click').live('click', function (e) {
        hideMsgBox();
    });
}

function SelectListViewIndex(idx) {
    var tr = $("#subtitleTable tr").eq(idx);
    listViewChange(tr, null);
}

function SelectListViewStartTime(start) {
    var len = subtitles.length;
    var idx = len - 1;
    for (var i = 0; i < len; i++) {
        var s = subtitles[i];
        if (s.start == start) {
            SelectListViewIndex(i);
            return;
        }
    }
    SelectListViewIndex(subtitles.length - 1);
}

function mergeWithNext(index) {
    var len = subtitles.length;
    if (index < 0 || index + 3 > len)
        return;
    var s = subtitles[index];
    var next = subtitles[index + 1];
    s.end = next.end;
    s.text = s.text + " " + next.text;
    s.duration = s.end - s.start;
    subtitles.splice(index + 1, 1);
    bindSubtitles();
    SelectListViewIndex(index);
}

function insertSubAtTime(seconds, sub) {
    var len = subtitles.length;
    for (var i = 0; i < len; i++) {
        var s = subtitles[i];
        if (s.start > seconds) {
            subtitles.splice(i, 0, sub);
            bindSubtitles();
            SelectListViewIndex(i);
            return;
        }
    }
    subtitles.push(sub);
    bindSubtitles();
    SelectListViewIndex(subtitles.length - 1);
}

jQuery.fn.center = function () {
    this.css("position", "absolute");
    this.css("top", (($(window).height() - this.outerHeight()) / 2) + $(window).scrollTop() + "px");
    this.css("left", (($(window).width() - this.outerWidth()) / 2) + $(window).scrollLeft() + "px");
    return this;
}

function videoGoBack(seconds) {
    if (v.readyState < 1)
        return;
    var t = v.currentTime;
    t = t - seconds;
    if (t < 0)
        t = 0;
    v.currentTime = t;
}

function removeFontTag(text) {
    var index = text.indexOf("<font");
    while (index >= 0)
    {
        var endIndex = text.indexOf(">", index + 2);
        if (endIndex == -1)
            return text;
        var temp = "";
        if (index > 0)
            temp = text.substr(0, index);
        if (endIndex+2 < text.length)
            temp = temp + text.substr(endIndex+1);
        text = temp;
        index = text.indexOf("<font");
    }
    return text;
}

function importGoogleTranslation(table) {
    hideMsgBox();
    var i = 0;        
    var trs = $(table).find('tr');
    trs.each(function (i, n) {
        var text = $(n).find("td").eq(0).html() + "";
        text = removeFontTag(text);            
        subtitles[i].text = text;
        i++;
    });
    bindSubtitles();
    if (subtitles.length > 0)
        SelectListViewIndex(0);
}

function openSubtitle() {
    hideMsgBox();
    $.ajax({
        type: 'POST',
        url: "/SubtitleEdit/OnlineGetSubtitle",
        dataType: 'json',
        success: function (data) {
            subtitles = data;
            bindSubtitles();
            if (subtitles.length > 0)
                SelectListViewIndex(0);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error: " + textStatus);
            alert("Incoming text: " + jqXHR.responseText);
        }
    });
}

function loadSettings() {
    if (storage) {
        timeLineCenter = storage["SEOnline_settings_TimeLineCenter"] == "true";
        var autoSave = storage["SEOnline_settings_AutoSave"] == "true";
        if (timeLineCenter)
            $('#settingCenterTimeLine').attr("checked", "checked");
        if (autoSave)
            $('#settingAutoSave').attr("checked", "checked");
        var userWindowsNewLine = storage["SEOnline_settings_WinNewLine"] == "true";
        if (userWindowsNewLine)
            $('#settingWindowsNewLine').attr("checked", "checked");
    }
}

function saveSettings() {
    if (storage) {
        storage["SEOnline_settings_TimeLineCenter"] = timeLineCenter;
        storage["SEOnline_settings_AutoSave"] = $('#settingAutoSave').attr('checked') == 'checked';
        storage["SEOnline_settings_WinNewLine"] = $('#settingWindowsNewLine').attr('checked') == 'checked';
    }
}

function autoSaveLastSubtitleAndVideo() {
    if (storage && $('#settingAutoSave').attr('checked') == 'checked') {
        storage["SEOnline_subtitles"] = JSON.stringify(subtitles);
        storage["SEOnline_video"] = v.src;
    }
}

function loadLastSubtitleAndVideoOrDefault() {
    if (storage && $('#settingAutoSave').attr('checked') == 'checked') {
        var s = storage["SEOnline_subtitles"];
        var videoFileUrl = storage["SEOnline_video"];
        if (s != undefined && s != null && s.length > 0) {
            subtitles = JSON.parse(s);
            if (subtitles != null) {
                bindSubtitles();
                if (videoFileUrl.length > 0)
                    v.src = videoFileUrl;
                return;
            }
        }
    }
    loadSampleSubtitlesAndVideo();
}

function loadSampleSubtitlesAndVideo() {
    subtitles = new Array();
    var startUps = [{ "start": 1.981, "end": 4.682, "text": "We're quite content to be the odd<br>browser out." }, { "start": 5.302, "end": 8.958, "text": "We don't have a fancy stock abbreviation <br>to go alongside our name in the press." }, { "start": 9.526, "end": 11.324, "text": "We don't have a profit margin." }, { "start": 11.413, "end": 13.979, "text": "We don't have sacred rock stars<br>that we put above others." }, { "start": 14.509, "end": 16.913, "text": "We don't make the same deals,<br>sign the same contracts." }, { "start": 17.227, "end": 19.789, "text": "Or shake the same hands,<br>as everyone else." }, { "start": 20.568, "end": 22.568, "text": "And all this... is fine by us." }, { "start": 23.437, "end": 27.065, "text": "Were are a pack of independently, spirited, <br>fiercely unconventional people," }, { "start": 27.145, "end": 29.145, "text": "who do things a little differently." }, { "start": 29.81, "end": 31.81, "text": "Where another company may value<br>the bottom line..." }, { "start": 32.283, "end": 34.583, "text": "We value... well, values." }, { "start": 35.644, "end": 38.012, "text": "When a competitor considers <br>to make something propriertary." }, { "start": 38.642, "end": 40.642, "text": "We strive to set it free." }, { "start": 40.929, "end": 44.556, "text": "And while most products and technologies <br>are developed behind closed doors." }, { "start": 44.886, "end": 46.606, "text": "Ours are cultivated out in the open." }, { "start": 46.651, "end": 48.525, "text": "For everyone to see."}];
    for (var i = 0; i < startUps.length; i++) {
        var pIn = startUps[i];
        subtitles.push(new paragraph(i + 1, pIn.start, pIn.end, pIn.text));
    }
    bindSubtitles();
    if (v.canPlayType("video/mp4") != "")
    //    v.src = 'file:///D:/Download/Mozilla_Firefox_Manifesto_v0.2_640.mp4';
        v.src = 'http://videos.cdn.mozilla.net/brand/Mozilla_Firefox_Manifesto_v0.2_640.mp4';
    else
        v.src = 'http://videos.cdn.mozilla.net/brand/Mozilla_Firefox_Manifesto_v0.2_640.webm';
}


function downloadURI(uri, name) {
    var link = document.createElement("a");
    link.download = name;
    link.href = uri;
    link.click();
}

/////////////////////////////////////////////////////////////////////////////////////

$(document).ready(function () {
    v = $('#video')[0];
    $("#listviewContextMenu").hide();
    $('#pause').click(function () {
        if (v.readyState >= 1) {
            v.pause();
        }
    });
    $('#play').click(function () {
        if (v.readyState >= 1) {
            v.play();
        }
    });
    $('#setStart').click(function () {
        if (v.readyState >= 1) {
            v.play();
        }
    });
    $('#setEnd').click(function () {
        if (v.readyState >= 1) {
        }
    });

    $('#goBack3Secs').click(function () {
        videoGoBack(3.0);
    });
    $('#goBack100Ms').click(function () {
        videoGoBack(0.1);
    });
    $('#play2SecsAndBack').click(function () {
        if (v.readyState >= 1) {
            t = v.currentTime;
            if (v.paused)
                v.play();
            setTimeout(function () {
                v.pause();
                v.currentTime = t;
            }, 2000);
        }
    });
    $('#insertAtVideoPos').click(function () {
        if (v.readyState >= 1) {
            var sub = new paragraph(0, v.currentTime, v.currentTime + 2, '');
            insertSubAtTime(v.currentTime, sub);
            $("#currentText").focus();
        }
    });

    $(".hidden").hide();

    // Feature detect + local reference of window.localStorage
    try {
        var uid = new Date;
        storage = window.localStorage;
        storage.setItem(uid, uid);
        if (storage.getItem(uid) != uid) {
            storage = false;
        }
    } catch (e) { }

    loadSettings();
    loadLastSubtitleAndVideoOrDefault();

    sliderPos = $("#controlBarSliderPosition");
    sliderPos.slider({
        start: function (event, ui) {
            sliderPosMoving = true;
        },
        stop: function (event, ui) {
            if (v.readyState >= 1) {
                var pos = sliderPos.slider('value') * v.duration / 100.0;
                v.currentTime = pos;
            }
        },
        slide: function (event, ui) {
            if (v.readyState >= 1) {
                var pos = sliderPos.slider('value') * v.duration / 100.0;
                v.currentTime = sliderPos.slider('value') * v.duration / 100.0;
            }
        }
    });

    $("#controlBarSliderVolume").slider({
        stop: function (event, ui) {
            if (v.readyState >= 1) {
                var volume = $(this).slider('value') / 100.0;
                v.volume = volume;
            }
        },
        slide: function (event, ui) {
            if (v.readyState >= 1) {
                var volume = $(this).slider('value') / 100.0;
                v.volume = volume;
            }
        }
    });


    $('#subtitleTableBody tr:even').addClass('listViewAlternate');
    $('#subtitleTableBody tr > td').live('contextmenu', function (e) {
        if (e.which == 3) {
            e.preventDefault();
            listViewContextMenuPopup($(this).parent(), e);
            return false;
        }
    });
    $('#listviewContextMenu').live('mouseleave', function () {
        $('#listviewContextMenu').hide('fade');
    });
    $('#subtitleTableBody tr > td').live('click', function (e) {
        listViewChange($(this).parent(), e);
    });
    $('#subtitleTableBody tr > td').live('dblclick', function (e) {
        var tr = $(this).parent();
        var idx = $("#subtitleTable tr").index(tr);
        var start = subtitles[idx].start;
        if (v.readyState >= 1) {
            v.currentTime = start;
        }
    });

    $('#autoBreakText').live('click', function (e) {
        var text = $('#currentText').val();
        if (text.length < 2)
            return;
        $.ajax({
            type: 'POST',
            url: "/SubtitleEdit/OnlineAutoBreak",
            data: 'text=' + text,
            success: function (data) {
                $('#currentText').val(data);
                currentTextChange();
            },
            error: function (jqXHR, textStatus, errorThrown) {
                alert("Error: " + textStatus);
            }
        });
    });

    $('#unBreakText').live('click', function (e) {
        var text = $('#currentText').val();
        if (text.length < 2)
            return;
        text = text.replace("\n", " ");
        text = text.replace("  ", " ");
        $('#currentText').val(text);
        currentTextChange();
    });

    canvas = document.getElementById('timeLineCanvas');
    if (canvas.getContext)
        ctx = canvas.getContext('2d');
    $(canvas).live('dblclick', function (e) {
        if (v.readyState >= 1) {
            var pos = e.pageX - $(canvas).offset().left;
            v.currentTime = timeLineStart + timeLinePositiontoSeconds(pos);
        }
    });
    $(canvas).live('contextmenu', function (e) {
        if (e.which == 3) {
            e.preventDefault();
            timeLineContextMenuPopup(e);
            return false;
        }
    });
    $(canvas).live('mousewheel', function (event, delta) {
        if (v.readyState >= 1) {
            if (delta > 0)
                v.currentTime += 1.5;
            else
                v.currentTime -= 1.5;
        }
    });
    $('#timeLineContextMenu').live('mouseleave', function () {
        $('#timeLineContextMenu').hide('fade');
    });
    $(canvas).mousemove(function (e) {
        var pos = e.pageX - $(canvas).offset().left;
        var cstyle = timeLineMouseOver(pos);
        $(canvas).css("cursor", cstyle);
        if (cstyle == 'default' && timeLineIsMouseDown) {
            if (timeLineNewEnd >= 0 && timeLineStart >= 0)
                timeLineNewEnd = timeLinePositiontoSeconds(pos) + timeLineStart;
        }
    }).mouseleave(function () {
        timeLineMoveStart = false;
        timeLineMoveEnd = false;
        timeLineMoveIndex = -1;
        timeLineIsMouseDown = false;
    });
    $(canvas).live('mousedown', function (e) {
        var pos = e.pageX - $(canvas).offset().left;
        timeLineMouseDown(e, pos);
        timeLineIsMouseDown = true;
    });
    $(canvas).live('mouseup', function (e) {
        timeLineMoveStart = false;
        timeLineMoveEnd = false;
        timeLineMoveIndex = -1;
        timeLineIsMouseDown = false;
        if (timeLineNewStart <= 0 || timeLineNewEnd <= 0 || Math.abs(timeLineNewStart - timeLineNewEnd) <= 0.2) {
            timeLineNewStart = -1.0;
            timeLineNewEnd = -1.0;
        }
    });

    setTimeout(videoReady, 500);

    $('#currentText').live('keyup', function (e) {
        currentTextChange();
    });

    $(document).keydown(function (e) {
        var tr;
        ctrlDown = e.ctrlKey;

        if (!$('#currentText').is(":focus")) {
            if (e.keyCode == 32) { // space
                if (v.readyState >= 1) {
                    if (v.paused)
                        v.play();
                    else
                        v.pause();
                }
            } else if (e.keyCode == 38) { // up
                if (currentTr.html() == $("#subtitleTableBody tr:first").html())
                    return;
                tr = $(currentTr).prev();
                listViewChange(tr, e);
            } else if (e.keyCode == 40) { // down
                if (currentTr.html() == $("#subtitleTableBody tr:last").html())
                    return;
                tr = $(currentTr).next();
                listViewChange(tr, e);
            }
        }
    });

    $(document).keyup(function (e) {
        ctrlDown = e.ctrlKey;
    });

    $('.contextMenu li').hover(function () { $(this).toggleClass('highlight'); });

    $('#lineDelete').live('click', function (e) {
        $('#listviewContextMenu').hide('fade');
        var tr = $(currentTr).next();
        $(currentTr).remove();
        listViewChange(tr, e);
        renumberSubtitlesInTable();
        loadSubtitlesFromTable();
    });
    $('#timeLineDelete').live('click', function (e) {
        $('#timeLineContextMenu').hide('fade');
        timeLineContextMenuIndex = -1;
        var tr = $(currentTr).next();
        $(currentTr).remove();
        listViewChange(tr, e);
        renumberSubtitlesInTable();
        loadSubtitlesFromTable();
    });
    $('#lineInsertBefore').live('click', function (e) {
        $('#listviewContextMenu').hide('fade');
        if (currentTr == null)
            return;
        var target = getParagraphFromTr(currentTr);
        var sub = new paragraph(0, target.start - 2.7, target.start - 0.2, '');
        $(currentTr).before(getSubTr(sub));
        var tr = $(currentTr).prev();
        listViewChange(tr, e);
        $('#currentText').focus();
        renumberSubtitlesInTable();
        loadSubtitlesFromTable();
    });
    $('#timeLineInsertBefore').live('click', function (e) {
        $('#timeLineContextMenu').hide('fade');
        timeLineContextMenuIndex = -1;
        if (currentTr == null)
            return;
        var target = getParagraphFromTr(currentTr);
        var sub = new paragraph(0, target.start - 2.7, target.start - 0.2, 2.5, '');
        $(currentTr).before(getSubTr(sub));
        var tr = $(currentTr).prev();
        listViewChange(tr, e);
        $('#currentText').focus();
        renumberSubtitlesInTable();
        loadSubtitlesFromTable();
    });
    $('#lineInsertAfter').live('click', function (e) {
        $('#listviewContextMenu').hide('fade');
        if (currentTr == null)
            return;
        var target = getParagraphFromTr(currentTr);
        var sub = new paragraph(0, target.end + 0.2, target.end + 2.5, '');
        $(currentTr).after(getSubTr(sub));
        var tr = $(currentTr).next();
        listViewChange(tr, e);
        $('#currentText').focus();
        renumberSubtitlesInTable();
        loadSubtitlesFromTable();
    });
    $('#timeLineInsertAfter').live('click', function (e) {
        $('#timeLineContextMenu').hide('fade');
        timeLineContextMenuIndex = -1;
        if (currentTr == null)
            return;
        var target = getParagraphFromTr(currentTr);
        var sub = new paragraph(0, target.end + 0.2, target.end + 2.5, '');
        $(currentTr).after(getSubTr(sub));
        var tr = $(currentTr).next();
        listViewChange(tr, e);
        $('#currentText').focus();
        renumberSubtitlesInTable();
        loadSubtitlesFromTable();
    });
    $('#lineMergeWithNext').live('click', function (e) {
        $('#listviewContextMenu').hide('fade');
        if (currentTr == null)
            return;
        var nextTr = $(currentTr).next();
        if (nextTr == 'undefined')
            return;

        var sub = getParagraphFromTr(currentTr);
        var nextSub = getParagraphFromTr(nextTr);
        sub.end = nextSub.end;
        sub.duration = sub.end - sub.start;
        sub.text = sub.text + "\n" + nextSub.text;
        currentTr.html(getSubTds(sub));

        $(nextTr).remove();
        renumberSubtitlesInTable();
        loadSubtitlesFromTable();
        listViewChange(currentTr, e);
    });
    $('#timeLineMergeWithNext').live('click', function (e) {
        $('#timeLineContextMenu').hide('fade');
        mergeWithNext(timeLineContextMenuIndex);
        timeLineContextMenuIndex = -1;
    });
    $('#timeLineInsertHere').live('click', function (e) {
        $('#timeLineContextMenu').hide('fade');
        var start = timeLineNewStart;
        var end = timeLineNewEnd;
        if (start > end) {
            var temp = start;
            start = end;
            end = temp;
        }
        var sub = new paragraph(0, start, end, "");
        insertSubAtTime(start, sub);
        bindSubtitles();
        timeLineNewStart = -1.0;
        timeLineNewEnd = -1.0;
        SelectListViewStartTime(start);
        $('#currentText').focus();
    });


    $('#timeLineContextMenu').live('click', function (e) {
        $('#listviewContextMenu').hide('fade');
    });

    // top menu
    $('#mainMenu ul > li > ul').hide();
    $('#mainMenu ul > li').live('mouseover', function (e) {
        $(this).find("ul").css('left', $(this).offset().left + 'px');
        $(this).find("ul").show();
    });
    $('#mainMenu ul > li').live('mouseout', function (e) {
        $(this).find("ul").hide();
    });

    $('#subtitleNew').live('click', function (e) {
        $(this).closest('ul').hide();
        subtitles = new Array();
        subtitles.push(new paragraph(1, 0, 3, '-empty-'));
        bindSubtitles();
        SelectListViewIndex(0);
    });

    $('#syncShowEarlierLater').live('click', function (e) {
        $(this).parent("ul").hide();
        showFullscreenDialog($("#syncMenuShowEarlierLater"));
    });

    $('#syncChangeFrameRate').live('click', function (e) {
        $(this).parent("ul").hide();
        showFullscreenDialog($("#syncMenuChangeFrameRate"));
    });
    $('#buttonChangeFrameRate').live('click', function (e) {
        hideMsgBox();
        var oldFrameRate = $("#oldFrameRate").val();
        var newFrameRate = $("#newFrameRate").val();
        var len = subtitles.length;
        for (var i = 0; i < len; i++) {
            var sub = subtitles[i];
            var startFrame = sub.start * oldFrameRate;
            var endFrame = sub.end * oldFrameRate;
            sub.start = startFrame / newFrameRate;
            sub.end = endFrame / newFrameRate;
        }
        bindSubtitles();
    });

    $('#doGoogleTranslate').live('click', function (e) {
        var x = $("#iframeGT");
        if (x != "undefined")
            x.remove();

        $(this).parent("ul").hide();
        $.ajax({
            type: 'POST',
            url: "/SubtitleEdit/OnlineTranslateInit",
            data: JSON.stringify(subtitles),
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            success: function (data) {
                $("#translateIframe").html('<iframe id="iframeGT" src="/SubtitleEdit/OnlineTranslate?id=' + data + '" style="width:100%; height:100%"></iframe>');
                showFullscreenDialog($("#doGoogleTranslateText"));
            },
            error: function (jqXHR, textStatus, errorThrown) {
                hideMsgBox();
                alert("Error: " + textStatus);
                alert("Incoming text: " + jqXHR.responseText);
            }
        });
    });

    $('#doBingTranslate').live('click', function (e) {
        var x = $("#iframeGT");
        if (x != "undefined")
            x.remove();

        $(this).parent("ul").hide();
        $.ajax({
            type: 'POST',
            url: "/SubtitleEdit/OnlineTranslateInit",
            data: JSON.stringify(subtitles),
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            async: false,
            cache: false,
            success: function (data) {
                setTimeout(function() {
                    $("#translateBingIframe").html('<iframe id="iframeGT" src="/SubtitleEdit/OnlineTranslateBing?id=' + data + '" style="width:100%; height:100%"></iframe>');
                    showFullscreenDialog($("#doBingTranslateText"));
                }, 300);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                hideMsgBox();
                alert("Error: " + textStatus);
                alert("Incoming text: " + jqXHR.responseText);
            }
        });
    });

    $('#optionsSettings').live('click', function (e) {
        showFullscreenDialog($("#optionsSettingsText"));
    });
    $('#settingCenterTimeLine').live('click', function (e) {
        timeLineCenter = $('#settingCenterTimeLine').is(':checked');
        saveSettings();
    });
    $('#settingAutoSave').live('click', function (e) {
        saveSettings();
        if ($('#settingAutoSave').attr('checked') != 'checked') {
            storage.removeItem("SEOnline_subtitles");
            storage.removeItem("SEOnline_video");
        }
    });

    $('#aboutHelp').live('click', function (e) {
        $(this).parent("ul").hide();
        showFullscreenDialog($("#helpText"));
    });
    $('#aboutAbout').live('click', function (e) {
        $(this).parent("ul").hide();
        showFullscreenDialog($("#aboutText"));
    });
    $('#videoOpen').live('click', function (e) {
        $(this).parent("ul").hide();
        showFullscreenDialog($("#videoOpenText"));
    });
    $('#buttonLoadVideo').live('click', function (e) {
        var src = $('#videoOpenSource').val();
        if (src.length < 2) {
            alert('Please enter a video url');
            return;
        }
        v.src = src;
        hideMsgBox();
        v.play();
    });
    $('#subtitleOpen').live('click', function (e) {
        if ($("#openSubtitleIframe").length == 0)
            $("#openSubtitleIframeContainer").html('<iframe id="openSubtitleIframe" src="/SubtitleEdit/OnlineOpenSubtitle"></iframe>');

        $(this).parent("ul").hide();
        showFullscreenDialog($("#subtitleOpenText"));
    });
    $('#subtitleDownload').live('click', function (e) {
        $(this).parent("ul").hide();
        showFullscreenDialog($("#subtitleDownloadText"));
    });
    $('#subtitleExportPlainText').live('click', function (e) {
        $(this).parent("ul").hide();
        showFullscreenDialog($("#subtitleDownloadPlainText"));
    });
    $('#subtitleDownloadOK').live('click', function (e) {
        var useCrlf = $('#settingWindowsNewLine').attr('checked') === 'checked';
        $.ajax({
            url: "/SubtitleEdit/OnlineSetFormat",
            data: "format=" + $('#subtitleDownloadFormat').val(),
            success: function (data) {
                $.ajax({
                    type: 'POST',
                    url: "/SubtitleEdit/OnlineUploadSubtitle?formatName=" + encodeURIComponent($('#subtitleDownloadFormat').val()) + "&crlf=" + useCrlf,
                    data: JSON.stringify(subtitles),
                    contentType: "application/json; charset=utf-8",
                    dataType: 'json',
                    success: function (data) {
                        hideMsgBox();
                        window.location = '/SubtitleEdit/OnlineDownloadSubtitle';
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        hideMsgBox();
                        alert("Error: " + textStatus);
                        alert("Incoming text: " + jqXHR.responseText);
                    }
                });
            },
            error: function (jqXHR, textStatus, errorThrown) {
                hideMsgBox();
                alert("Error: " + textStatus);
                alert("Incoming text: " + jqXHR.responseText);
            }
        });
    });

    $('#subtitleExportPlainTextOK').live('click', function (e) {
        var removeStyling = $('#exportPlainTextRemoveStylingCheckBox').attr('checked') === 'checked';
        var formatting = $("input:radio[name ='exportPlainTextStyle']:checked").val();
        $.ajax({
            type: 'POST',
            url: "/SubtitleEdit/GetPlainText?formatting=" + formatting + "&removeStyling=" + removeStyling,
            data: JSON.stringify(subtitles),
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            cache: false,
            success: function (data) {
                hideMsgBox();
                //window.location = 'data:text/plain;filename:subtitle.ext;attqachment;charset=utf-8,' + encodeURIComponent(data);
                window.location = '/download/OnlineDownloadPlainText';//'?subtitles=' + encodeURIComponent(JSON.stringify(subtitles));
            },
            error: function (jqXHR, textStatus, errorThrown) {
                hideMsgBox();
                alert("Error: " + textStatus);
                alert("Incoming text: " + jqXHR.responseText);
            }
        });
    });

    // add close buttons to all dialogs
    $('.msgBoxText').prepend('<a class="closeButton" href="#">X</a>');
    $('.closeButton').live('click', function (e) {
        hideMsgBox();
    });

    $('#showEarlierLaterSliderSeconds').slider({
        stop: function (event, ui) {
            $('#showEarlierLaterSeconds').html($('#showEarlierLaterSliderSeconds').slider('value') / 10.0);
        },
        slide: function (event, ui) {
            $('#showEarlierLaterSeconds').html($('#showEarlierLaterSliderSeconds').slider('value') / 10.0);
        },
        value: 10.0
    });
    $('#buttonShowEarlierLaterDone').live('click', function (e) {
        hideMsgBox();
    });
    $('#buttonShowEarlier').live('click', function (e) {
        var adjustSeconds = parseFloat($('#showEarlierLaterSeconds').html());
        var len = subtitles.length;
        for (var i = 0; i < len; i++) {
            var sub = subtitles[i];
            sub.start = sub.start - adjustSeconds;
            sub.end = sub.end - adjustSeconds;
        }
        bindSubtitles();
    });
    $('#buttonShowLater').live('click', function (e) {
        var adjustSeconds = parseFloat($('#showEarlierLaterSeconds').html());
        var len = subtitles.length;
        for (var i = 0; i < len; i++) {
            var sub = subtitles[i];
            sub.start = sub.start + adjustSeconds;
            sub.end = sub.end + adjustSeconds;
        }
        bindSubtitles();
    });

    setInterval(autoSaveLastSubtitleAndVideo, 10000);

});
