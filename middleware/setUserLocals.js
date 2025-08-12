const User= require('../models/user')
module.exports=async(req,res,next)=>{
    res.locals.user=null


    if(req.session&&req.session.userId){
        try{
            const user= await User.findById(req.session.userId)
            res.locals.user= user||null
        }catch(err){
            console.log('Error oin fetching user for locals:',err)
        }
    }
    next()
}