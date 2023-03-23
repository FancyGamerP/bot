const mf = require("mineflayer")
const vec3 = require("vec3")

const bot = mf.createBot({  //node mf host port botname 
    host: process.argv[2],
    port: Number(process.argv[3]),
    username: process.argv[4]
})
let botstat = { moving: 0, attack: 0, cd: 0, diff: 'normal', strafe: 1, spcd: 0, jump: 0, eat:0}
function rand(max, round = true) { return (round == 0) ? max * Math.random() : Math.round(max * Math.random()) }
let log = console.log
let diffdata = {
    'reach': { 'noob': 1.5, 'easy': 2, 'normal': 2.5, 'hard': 3, 'hacker': 3.2 }, // e
    'jump': { 'noob': 0, 'easy': 0.0, 'normal': 0.0, 'hard': 0.15, 'hacker': 0.5 },
    'crit': { 'noob': 0, 'easy': 0, 'normal': 0.15, 'hard': 0.5, 'hacker': 1 },
    'chances': { 'noob': 0.574, 'easy': 0.659 , 'normal':  0.757, 'hard': 0.87, 'hacker': 1 }
}
bot.on('spawn', (e) => {
    log(`spawned, ${e}`)
    bot.waitForChunksToLoad().then(botloop)
})
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
            eat(bot)
            break;
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
    if (botstat.moving === 1) { //if moves
        let pos, dist, dir
        let ent = bot.nearestEntity(entity => { if (['mob', 'player'].includes(entity.type)) { return 1 } else { return 0 } })//only mob and players
        if (botstat.cd === 0) { bot.setControlState('sprint', true); bot.setControlState('forward', true); }    //toggles sprint by status
        else { bot.setControlState('forward', false); bot.setControlState('sprint', false) }
        if (botstat.jump === 0) { bot.setControlState('jump', false) } else { bot.setControlState('jump', true) }//toggles sprint by status
        if (ent) {  //entity found
            pos = vec3(ent.position.x, ent.position.y + ent.height / 2, ent.position.z) //adjusted position
            if (bot.player.entity) { dist = ent.position.distanceTo(bot.player.entity.position) } else { dist = 4 } //calculating reach
            if (botstat.attack == 1) {  //if attacking is enabled
                if (botstat.strafe == 1) {
                    dir = ['left', 'right'][rand(1)]    //random side 
                    bot.setControlState(dir, true);    //strafe
                    botstat.strafe = 0
                    bot.waitForTicks(rand(20)).then(() => { //reset side
                        bot.setControlState(dir, false)
                        botstat.strafe = 1
                    })
                }
                //if (rand(1) < diffdata['chances'][botstat.diff]) 
                if (botstat.cd === 0 && dist < diffdata['reach'][botstat.diff]) {   //no hit cd and in reach
                    if (rand(1, 0) < diffdata['jump'][botstat.diff]) { botstat.jump = 1 } else { botstat.jump = 0 }
                    if (rand(1, 0) < diffdata['crit'][botstat.diff] && bot.entity.velocity.y < -0.15) { bot.setControlState('sprint', false) }
                    bot.attack(ent); botstat.cd = 1; botstat.spcd = 1
                    bot.waitForTicks(10 + rand(3)).then(() => { botstat.cd = 0; botstat.spcd = 0 }) //puts hit cd and stops sprint
                }
            }
            if (rand(1) < diffdata['chances'][botstat.diff]) bot.lookAt(pos)   //looks at player based on chances
            if(bot.food<16) eat(bot) //eats if get hunger
        } else { /*log('no entity') */ }
    }
    bot.waitForTicks(2).then(botloop)
}
function eat(bot) {
    if(!bot) return
    if(botstat.eat==1) return
    let firstitem = bot.heldItem
    let attack = botstat.attack
    bot.inventory.items().forEach(item => {
        ['cooked', 'raw', 'apple'].forEach(foods => {   //types of food
            if (item.name.includes(foods)) {
                bot.equip(item); bot.activateItem(); botstat.attack = 0;botstat.eat=1
                bot.waitForTicks(45).then(() => { if (firstitem) bot.equip(firstitem); botstat.attack = attack;botstat.eat=0})
            }
        })
    })
}
bot.on('kicked', (e) => { log(e) })
bot.on('еrror', (e) => { log(e) })
