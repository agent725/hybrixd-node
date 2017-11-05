// User interface transformations
UItransform = {
  formatFloat : function(n) {       // not being used yet!
        return String(Number(n));
      },
  txStart : function() {
        $('#action-send .pure-button-send').addClass('pure-button-disabled').removeClass('pure-button-primary');
        $('#action-send').css('opacity', '0.7');
      },
  txStop : function() {
        $('#action-send .pure-button-send').removeClass('pure-button-disabled').addClass('pure-button-primary');
        $('#action-send').css('opacity', '1');
      },
  txHideModal : function() {
        $('#action-send').modal('hide').css('opacity', '1');        
      },      
  setBalance : function(element,setBalance) {
        $(element).html(setBalance);
      },
  deductBalance : function(element,newBalance) {
        $(element).html('<span style="color:#D77;">'+String(newBalance))+'</span>';
      }
}

// main asset management code
$(document).ready( function(){
  // fill advanced modal with work-in-progress icon
  var output = '<div style="text-align: center; margin-left: auto; margin-right: auto; width: 30%; color: #CCC;">'+svg['cogs']+'</div>';
  $('#advancedmodal').html(output);	// insert new data into DOM

  // attached buttons and actions
  $('#send-transfer').click(function() {
    if ($("#send-transfer").hasClass("disabled")) {
      // UItransform. Cannot send; please fill in text fields.
    } else {
      // send transfer
      var symbol = $('#action-send .modal-send-currency').attr('asset');
      sendTransaction({
        element:'.assets-main > .data .balance-'+symbol.replace(/\./g,'-'),
        asset:symbol,
        amount:Number($("#modal-send-amount").val().replace(/\,/g,'.')),
        source:String($('#action-send .modal-send-addressfrom').html()).trim(),
        target:String($('#modal-send-target').val()).trim()
      });
    }
  });

  // elements: MAIN
  $('.assets-main .spinner-loader').fadeOut('slow', function() {
    balance = {}
    balance.asset = [];
    balance.amount = [];
    balance.lasttx = [];
    GL.cur_step = next_step();
    $.ajax({ url: path+zchan(GL.usercrypto,GL.cur_step,'a'),
      success: function(object){
        object = zchan_obj(GL.usercrypto,GL.cur_step,object);
        var i = 0;
        var output = '';
        // create asset table
        output+='<table class="pure-table pure-table-striped"><thead>';
        output+='<tr><th>Asset</th><th>Balance</th><th class="actions"></th></tr></thead><tbody>';
        for (var entry in object.data) {
          balance.asset[i] = entry;
          balance.amount[i] = 0;
          balance.lasttx[i] = 0;
          var element=balance.asset[i].replace(/\./g,'-');
          output+='<tr><td class="asset asset-'+element+'">'+entry+'</td><td><div class="balance balance-'+element+'">'+progressbar()+'</div></td><td class="actions"><div class="assetbuttons-'+element+' disabled">';
          output+='<a onclick=\'fill_send("'+balance.asset[i]+'",$(".assets-main > .data .balance-'+element+'").html());\' href="#action-send" class="pure-button pure-button-primary" role="button" data-toggle="modal">Send</a>';
          output+='<a onclick=\'fill_recv("'+balance.asset[i]+'",$(".assets-main > .data .balance-'+element+'").html());\' href="#action-receive" class="pure-button pure-button-secondary" role="button" data-toggle="modal">Receive</a>';
          output+='<a href="#action-advanced" class="pure-button pure-button-grey" role="button">Advanced</a>';
          output+='</div></td></tr>';
          i++;
        }
        output+='</tbody></table>';
        // refresh assets
        ui_assets({i:i,balance:balance,path:path});
        intervals = setInterval( function(path) {
          ui_assets({i:i,balance:balance,path:path});
        },30000,path);
        $('.assets-main > .data').html(output);	// insert new data into DOM
      }
    });
  });
});
