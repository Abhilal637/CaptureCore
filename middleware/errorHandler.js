module.exports= (err,req,res,next)=>{
    console.log(err.stack)


    if(req.headers['content-type']==='application/json'){
        return res.status(err.status||STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success:false,
            message:err.message||'Server Error'
        })
    }


    res.status(err.status||STATUS_CODES.INTERNAL_SERVER_ERROR);
    res.render('error',{
        message:err.message||'Something went wrong!',
        error:process.env.NODE_ENV==='development'?err:{}
    })
}