function isUserLoggedIn(req, res, next) {
    if(req.session && req.session.userId){
        return next()

    }
    return next()
}
function preventLoginIfLoggedIn(req, res, next){
    if(req.session && req.session.userId){
        return res.redirect('/')
    }
    next()
}


function noCache(req, res, next){
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    next()
}

module.exports = {
    isUserLoggedIn,
    preventLoginIfLoggedIn,
    noCache
}