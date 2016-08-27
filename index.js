process.exit('killall' ['-9', 'telnet'])

var Botkit = require('botkit');
var controller = Botkit.slackbot();
var bot = controller.spawn({
  token: process.env.SLACK_TOKEN
})
bot.startRTM(function(err,bot,payload) {
  if (err) {
    console.log('Could not connect to Slack');
    process.exit(1);
  }
});
bot.rtm.on('close', function() {
  console.log('RTM close event');
  process.exit(1);  
});

var lastCommand = null;

var lastUser = null;

controller.hears("(.*)",['direct_mention'],function(bot,message) {
  var cmd = message.match[1];
  // bot.reply(message,'I heared: '+cmd+' from '+message.channel);
  console.log("Cmd: "+cmd);
  telnet.stdin.write(cmd+'\r');
  lastCommand = cmd;
  lastUser = message.user;
});

const spawn = require('child_process').spawn;
const telnet = spawn('telnet', ['-l', 'mud', 'mud2.co.uk']);

var buffer = '';

var preInPlay = false;
var inPlay = false;
var suppressEmote = false;
var echoResetNumber = false;
var showArrival = false;

telnet.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
  buffer += data;
  console.log(`buffer: ${buffer}`);

  // matchers.foreach(function(pair) {

  // });

  if (echoResetNumber && buffer.includes('This reset is number ')) {
    number = buffer.substring(buffer.indexOf('This reset is number '));
    console.log(number);
    number = number.split(/\./)[0];
    bot.say({
      attachments: [
      {
        fallback: number+'.',
        color: 'good',
        text: number+'.'
      }],
      channel: 'C23F11MB3' // not sure how you figure this out for yourself
    });
    echoResetNumber = false;
  }


  if (!inPlay && buffer.includes('Account ID: ')) {
    telnet.stdin.write('Z00006459\r');
    buffer = '';
  } else if (!inPlay && buffer.includes('Password: ')) {
    telnet.stdin.write(process.env.PASSWORD+'\r');
    buffer = '';
  } else if (!inPlay && buffer.includes('Do you want to supersede this other session?')) {
    telnet.stdin.write('y\r');
    buffer = '';
  } else if (!inPlay && buffer.includes('Checking your mail may take a while')) {
    telnet.stdin.write('n\r');
    buffer = '';
  } else if (!inPlay && buffer.includes('Hit return.')) {
    telnet.stdin.write('\r');
    buffer = '';
  } else if (buffer.includes('Option (H for help):')) {
    telnet.stdin.write('p\r');
    buffer = '';
    preInPlay = false;
    inPlay = false;
    echoResetNumber = true;
  } else if (!inPlay && buffer.includes('By what name shall I call you (Q to quit)?')) {
    telnet.stdin.write('relay\r');
    buffer = '';
    preInPlay = true;
  } else if (!inPlay && buffer.includes('What sex do you wish to be?')) {
    telnet.stdin.write('m\r');
    buffer = ''
    preInPlay = true;
  } else if (preInPlay || inPlay) {
    buffer = buffer.replace(/\x1b\[[0-9;]*[mG]/g, '');

    while(buffer.includes('*')) {
      // console.log('In buffer: '+buffer);

      var pos = buffer.indexOf('*');
      var line = buffer.substring(0,pos).trim();
      buffer = buffer.substring(pos+1);

      if (lastCommand && line.indexOf(lastCommand) == 0) {
        line = line.substring(lastCommand.length).trim();
        lastCommand = null;
      }

      if (preInPlay) {
        // console.log('Discarded: '+line);
        preInPlay = false;
        inPlay = true;
        showArrival = true;
      } else if (line.includes('You now feel up to attacking other players, should you so desire.')
          || line.includes(' has just left.')
          || line.includes('Hovering before you is Eros, wearing a blindfold.')
          || line.includes('You now feel up to attacking other players, should you so desire.')
          || line.includes('For your information:')
          || line.includes('You are carrying the following:')
          || line.includes('Auto-reset initiated')
          || line.includes('Something magical is happening.')
          || line == '') {
        // suppress
      } else if (line.includes('OK, ') && suppressEmote) {
        suppressEmote = false;
      } else {
        var echo = true;
        if (line.includes(' has just arrived.')) {
          echo = showArrival;
          line += ' -- only the first arrival of a reset will be shown'
          showArrival = false;
        }

        // if (line.includes(' tells you "')) {
        //   lastCommand = "re Hi! I am a bot that relays between the tearoom and the mud2.slack.com #teamroom channel. Mudmail Havoc with your email address for an invite."
        //   telnet.stdin.write(lastCommand+'\r');
        // }
        if (line.includes('In the distance, you hear a bell toll.')) {
          telnet.stdin.write('obit\r');
          lastCommand = 'obit';
        }

        if (line.includes('As you step through the opening') || line.includes(' in the place known as ')) {
          lastCommand = 'qq';
          telnet.stdin.write(lastCommand+'\r');
          line = '@havoc it looks like someone may have just abused the system.'
        }

        if (echo) {
          // console.log('Seen: '+line);
          bot.say({
            text: line,
            channel: 'C23F11MB3' // not sure how you figure this out for yourself
          });
        }
      }

      if (line.includes(' has just arrived.')) {
        if (Math.random() > 0.5) {
          emotes = ['wave', 'bow', 'nod']
          lastCommand = emotes[Math.floor(Math.random()*emotes.length)]
          telnet.stdin.write(lastCommand+'\r');
          suppressEmote = true;
        }
      }
    }
  }

});

telnet.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
  process.exit(1);
});

telnet.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});

// keep the connection alive
var interval = setInterval(function() {
  telnet.stdin.write('\r');
}, 30000);

setInterval(function() {
  bot.rtm.ping();
}, 5000);
