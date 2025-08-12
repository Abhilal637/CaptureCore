module.exports= (err,req,res,next)=>{
    console.log(err.stack)


    if(req.headers['content-type']==='application/json'){
        return res.status(err.status||500).json({
            success:false,
            message:err.message||'Server Error'
        })
    }


    res.status(err.status||500);
    res.render('error',{
        message:err.message||'Something went wrong!',
        error:process.env.NODE_ENV==='development'?err:{}
    })
}