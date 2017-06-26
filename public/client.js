// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  console.log('Client initialized.');
  
  $.get('/msg', function(msgs) {
    msgs.forEach(function(msg) {
      $('<li></li>').text(msg).appendTo('ul#msgs');
    });
  });

  $('form').submit(function(event) {
    event.preventDefault();
    var msg = $('input').val();
    $.post('/msg?' + $.param({msg: msg}), function() {
      $('<li></li>').text(msg).appendTo('ul#msgs');
      $('input').val('');
      $('input').focus();
    });
  });

});
