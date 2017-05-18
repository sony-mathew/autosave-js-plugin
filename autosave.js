/* Autosave Plugin

Quick Documentation Details
-----------------------------------------------------------------------------------------------------------------------
Dependency : jQuery
Author : Sony Mathew
Starts with intialization of Options
Options are 
1. autoSaveInterval
    This expects time  interval in milliseconds. Each autosave action will be performed in this time interval
    if the content of any of the elements specified in 'monitorChangesOf' changes.
2. autosaveUrl
    The data will submitted as POST to the url specified here.
3. monitorChangesOf
    This expects a hash. The key of the hash will specify the name of the parameter while sending to server and
    the value of the hash expects the DOM element ID or class[which has to be unique] to be monitored for changes.
    eg: { description: "#my_article_description", title: ".my_article_title" }
        This means it will send the below object
           { 
              "description" => content of "my_article_description"[id] element
              "title" => content of "my_article_title"[class] element
            } 
        as POST in autosave action in the specified time interval only if the content of either one of them changes.
4. extraParams
    This expects a hash. If you want some other extra params to be send to backend along with the data in the 
    specified DOM elements, you can specify it here. This hash will be send along with the other specified DOM 
    element data and if the response contains any JSON with a key matching any key in extraParams, that keys 
    value will be updated as well. And next time this updated value will be send to the server.
5. responseCallback
    This expects a function with a single parameter. This will be called after each autosave action with the response
    recieved from the server.
6. minContentLength
    This is an integer value. This is used to check the content length of the elements monitored before submitting 
    in autosave. So autosave happens only if the monitored elements content is greater than minContentLength. You 
    have to enable minContentLengthCheck for this. It is enabled by default actually. Only if you pass minContentLength
    param as option will this work.
7. retryIfError
    This is a flag. If an autosave encounters a failure, by default it will stop. But if you enable this flag,
    autosave will keep on trying submiting the data in specific intervals as specified.


Along with the above options, few flags and counters are available which are listed as follows.
1. contentChanged
    This is flag, which is set to true if the content has changed in any of the fields which are monitored.
2. savingContentFlag
    This flag is set to true while the saving process is going on.
3. successCount
    This is counter. This keeps tracks of succesfull autosave attempts.
4. failureCount
    This is a counter. This kepps tracks of failed autosave attempts.
5. lastSaveStatus
    This is flag. This will be true if the last autosave attempt was succesfull or else false.
6. minContentLengthCheck
    This is a flag. This has to be enabled so that each input which is monitored will be checked for a min 
    content length. You have to pass an argument minContentLength in the opts if you enable this check.
    
*/
/*jslint browser: true, devel: true */

(function ($) {
  
  "use strict";

  //Script for autosaving content of a DOM element on change at a particular interval
  var AutoSaveContent = function (options) {
    this.initialize(options);
  };

  AutoSaveContent.prototype = {
    constructor: AutoSaveContent,

    contentChanged: false,
    savingContentFlag: false,
    successCount: 0,
    failureCount: 0,
    totalCount: 0,
    lastSaveStatus: true,
    timer: null,
    minContentLengthCheck: true,

    //Default options
    opts: {
      autosaveInterval: 30000,
      autosaveUrl: window.location.pathname,
      monitorChangesOf: {
        description: "#solution_article_description",
        title: "#solution_article_title"
      },
      extraParams: {},
      minContentLength: 0,
      retryIfError: false,
      responseCallback: function () {}
    },

    initialize: function (options) {
      this.opts = $.extend(this.opts, options);
      this.startSaving();
    },

    bindEvents: function () {
      var $this = this;
      $.each(this.opts.monitorChangesOf, function (key, value) {
        var $el = $(value);
        $el.data('previousSavedData', $el.val());

        $(value).on("change.autosave keyup.autosave", function () {
          if ($el.data('previousSavedData') !== $el.val()) {
            $this.contentChanged = true;
          }

        });
      });
    },

    getContent: function () {

      this.content = {};

      this.getMainContent();
      this.getExtraParams();
    },
    
    getMainContent: function () {
      var $this = this;

      $.each(this.opts.monitorChangesOf, function (key, value) {
        var $el = $(value);
        $this.content[key] = $el.val();
        if ('minContentLength' in $this.opts && $this.content[key] != null) {
          $this.minContentLengthCheck = ($this.content[key].length > $this.opts.minContentLength);
          if ($this.minContentLengthCheck == false) {
            return;
          }
        }
        $el.data('previousSavedData', $el.val());
      });
    },
    
    getExtraParams: function () {
      var $this = this;

      if (!$.isEmptyObject(this.opts.extraParams)) {
        $.each(this.opts.extraParams, function (key, value) {
          $this.content[key] = value;
        });
      }
    },

    autoSaveTrigger: function () {
      var $this = this;
      this.timer = setInterval(function () {
        if ($this.contentChanged) {
          if ($this.lastSaveStatus || (!$this.lastSaveStatus && $this.opts.retryIfError)) {
            $this.saveContent();
          }
        }
      }, this.opts.autosaveInterval);
    },

    saveContent: function () {
      this.getContent();

      if (!this.minContentLengthCheck || this.savingContentFlag) {
        return;
      }

      this.savingContentFlag = true;
      this.totalCount += 1;
      $.ajax({
        url: this.opts.autosaveUrl,
        type: 'POST',
        data: this.content,
        success: $.proxy(this.onSaveSuccess, this),
        error: $.proxy(this.onSaveError, this)
      });
    },
    
    onSaveSuccess: function (response) {
      this.contentChanged = false;
      this.updateExtraParams(response);
      this.savingContentFlag = false;
      this.lastSaveStatus = true;
      this.successCount += 1;
      this.opts.responseCallback(response);
    },
    
    onSaveError: function (xhr, ajaxOptions, thrownError) {
      this.savingContentFlag = false;
      this.contentChanged = true;
      this.lastSaveStatus = false;
      this.failureCount += 1;
      this.opts.responseCallback(xhr.status);
    },
    
    updateExtraParams: function (response) {
      var $this = this;
      //updating the extra params if it exists from the response
      if (!$.isEmptyObject(this.opts.extraParams)) {
        $.each(this.opts.extraParams, function (key, value) {
          if (response[key]) {
            $this.opts.extraParams[key] = response[key];
          }
        });
      }
    },
    
    stopSaving: function () {
      $.each(this.opts.monitorChangesOf, function (key, value) {
        $(value).off(".autosave");
      });
      clearInterval(this.timer);
    },

    startSaving: function () {
      this.bindEvents();
      this.autoSaveTrigger();
    }

  };

  /* Autosave PLUGIN Definiton */
  
  $.autoSaveContent = function (options) {
    return new AutoSaveContent(options);
  };
  
}(window.jQuery));