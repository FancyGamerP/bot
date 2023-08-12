const mf = require("mineflayer")
const vec3 = require("vec3")
const fs = require("fs")

let options = JSON.parse(fs.readFileSync("botoptions.txt"))
const bot = mf.createBot(options)
if(!bot) console.log("Error in creating bot")
let newpvp = (bot.protocolVersion>47) ? true : false
let botstat = { moving: 0, attack: 0, cd: 0, diff: 'normal', strafe: 0, spcd: 0, jump: 0, eat:0, delay:10}

function rand(max, round = true) { return (round == 0) ? max * Math.random() : Math.round(max * Math.random()) }
let log = console.log
let diffdata = {
    'reach': { 'noob': 1.5, 'easy': 1.889, 'normal': 2.381, 'hard': 3, 'hacker': 3.77 }, //  each other 26% larger
    'jump': { 'noob': 0, 'easy': 0.0, 'normal': 0.0, 'hard': 0.35, 'hacker': 0 },
    'crit': { 'noob': 0.5, 'easy':  0.5946, 'normal': 0.7071, 'hard': 0.84, 'hacker': 1 }, 
    'chances': { 'noob': 0.333, 'easy':  0.4382, 'normal': 0.5767, 'hard': 0.7589, 'hacker': 1 },	//each other 31% higher
}
bot.on('spawn', (e) => {
    log(`Spawned`)
	bot.setControlState('jump',false)
    bot.waitForChunksToLoad().then(botloop)
})
bot.on('whisper',(username, message, translate, jsonMsg, matches) => {if(message[0]==='/') {bot.chat(message.slice(1))}})
bot.on('chat', (username, msg, translate, jsonMsg, matches) => {
	console.log("Client message: "+msg)
    switch (msg) {
        case '!move':
            botstat.moving = 1; log('moving')
            break;
        case '!moven':
            botstat.moving = 0; log('not moving')
            break;
        case '!bye':
            log('exiting...'); process.exit();
            break;
        case '!attack':
            botstat.attack = 1; log('attacking')
            break;
        case '!attackn':
            botstat.attack = 0; log('not attacking')
            break;
		case '!offhand':
			bot.moveSlotItem(bot.getEquipmentDestSlot('hand'),bot.getEquipmentDestSlot('off-hand'))
			break;
        case '!equip':
            bot.inventory.items().forEach(async (item) => {
                if (item.name.includes('boots')) bot.waitForTicks(0).then(() => { bot.equip(item, 'feet').catch(()=>{}) })
                if (item.name.includes('leggings')) bot.waitForTicks(4).then(() => { bot.equip(item, 'legs').catch(()=>{}) })
                if (item.name.includes('chestplate')) bot.waitForTicks(8).then(() => { bot.equip(item, 'torso').catch(()=>{}) })
                if (item.name.includes('helmet')) bot.waitForTicks(12).then(() => { bot.equip(item, 'head').catch(()=>{}) })
                if (item.name.includes('sword') || item.name.includes('axe')) bot.waitForTicks(16).then(() => { bot.equip(item, 'hand').catch(()=>{}) })
                if (item.name.includes('totem') || item.name.includes('shield')) bot.waitForTicks(20).then(() => { bot.equip(item, 'off-hand').catch(()=>{}) })
            })
            break;
        case '!eat':
            eat(bot);break;
	case 'up': {bot.setControlState('back',false);bot.setControlState('forward',true)};break;
	case 'down': {bot.setControlState('forward',false);bot.setControlState('back',true)};break;
	case 'left': {bot.setControlState('right',false);bot.setControlState('left',true)};break;
	case 'right': {bot.setControlState('left',false);bot.setControlState('right',true)};break;
	case 'stop': {bot.setControlState('left',false);bot.setControlState('right',false);
	bot.setControlState('forward',false);bot.setControlState('back',false);};break;
    }
    if (msg.startsWith('!diff ')) {
        let diff = msg.slice(6);if(['noob','easy','normal','hard','hacker'].includes(diff)) {botstat.diff=diff;log(`Diff is now ${diff}`)} 
        else{botstat.diff = 'normal';log(`Wrong diff, set to normal`)}
    }
    if (msg.startsWith('!drop ')) {
        bot.inventory.items().forEach(item => { if (item.name.includes(msg.slice(6))) { log('found'); bot.tossStack(item) } })
        bot.inventory.containerItems().forEach(item => { if (item.name.includes(msg.slice(6))) { log('found'); bot.tossStack(item) } })
    }
})
function botloop() {
    if(bot.food<16) eat(bot) //eats if get hunger
    if (botstat.moving === 1) { //if moves
        let pos, dist, dir
        let ent = bot.nearestEntity(entity => { if (['Projectiles','Drops'].includes(entity.kind)) { return 0 } else { return 1 } })//only mob and players
        if (botstat.cd === 0) { bot.setControlState('sprint', true); bot.setControlState('forward', true); }    //toggles sprint by status
        else { bot.setControlState('forward', false); bot.setControlState('sprint', false) }
        if (botstat.jump === 0) { bot.setControlState('jump', false) } else { bot.setControlState('jump', true) }//toggles sprint by status
        if (ent) {  //entity found
            pos = vec3(ent.position.x, ent.position.y, ent.position.z) //adjusted position, was y/2
            if (bot.player.entity) { dist = ent.position.distanceTo(bot.player.entity.position) } else { dist = 4 } //calculating reach
            if (botstat.attack == 1) {  //if attacking is enabled
                if (botstat.strafe === 0 && dist < (diffdata['reach'][botstat.diff])+rand(3,false)) {
					 dir = ['left', 'right'][rand(1)]    //random side 
                    bot.setControlState(dir, true);    //strafe
                    botstat.strafe = 1
                    bot.waitForTicks(rand(25)+5).then(() => { //reset side
                        bot.setControlState(dir, false)
                        botstat.strafe = 0
                    })
				} //else {botstat.strafe = 0}
                if (botstat.cd === 0 && dist < diffdata['reach'][botstat.diff]) {   //no hit cd and in reach
                    if (rand(1, 0) < diffdata['jump'][botstat.diff]) { botstat.jump = 1 } else { botstat.jump = 0 }
                    if (rand(1, 0) < diffdata['crit'][botstat.diff] && bot.entity.velocity.y < -0.15 && newpvp==true) { bot.setControlState('sprint', false) }	//Stops sprint if attacking (1.9+)
					if(newpvp==true) {bot.delay = 5+rand(2,true)} else {bot.delay = 1+rand(2,true)} //adjsust hit delay
                    bot.attack(ent); botstat.cd = 1; botstat.spcd = 1
                    bot.waitForTicks(botstat.delay).then(() => { botstat.cd = 0; botstat.spcd = 0 }) //puts hit cd and stops sprint
                }
            }
            if (rand(1,false) < diffdata['chances'][botstat.diff]) bot.lookAt(pos)   //looks at player based on chances
        } else { return setTimeout(botloop,100)/*log('no entity') */ }
    } else {bot.setControlState('forward', false)} // WASN+t ELSE HERE
    bot.waitForTicks(2).then(botloop)
};log('test')
function eat(bot) {
    if(!bot) return;
    if(botstat.eat==1) return ; 
    let firstitem = bot.heldItem; 
    let attack = botstat.attack;
	let items = bot.inventory.items()
	items.forEach(item => {
        ['cooked', 'raw', 'apple'].forEach(foods => {   //types of food
            if (item.name.includes(foods)) {
                bot.equip(item); 
				if(item) {bot.activateItem();bot.activateItem(true)}
				botstat.attack = 0;botstat.eat=1 
                bot.waitForTicks(45).then(() => { if (firstitem) bot.equip(firstitem); botstat.attack = attack;botstat.eat=0})
            }
        })
    })
	{bot.activateItem(true);botstat.attack = 0;botstat.eat=1 ;log(6)
                bot.waitForTicks(45).then(() => { if (firstitem) bot.equip(firstitem); botstat.attack = attack;botstat.eat=0})}
}
bot.on('kicked', (e) => { log(e) })
bot.on('еrror', (e) => { log(e) })
