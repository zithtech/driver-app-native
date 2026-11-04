package com.driverclient.floating

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.ImageView
import kotlin.math.abs

class FloatingButtonView(context: Context, private val windowManager: WindowManager, private val onTabAction: () -> Unit) : FrameLayout(context) {

    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false

    private val imageView: ImageView

    init {
        // Setup circle background
        val shape = GradientDrawable()
        shape.shape = GradientDrawable.OVAL
        shape.setColor(Color.parseColor("#FFFFFF"))
        shape.setStroke(4, Color.parseColor("#E0E0E0"))
        
        background = shape
        elevation = 8f

        // Setup Image
        imageView = ImageView(context)
        val padding = (8 * context.resources.displayMetrics.density).toInt()
        imageView.setPadding(padding, padding, padding, padding)
        val resId = context.resources.getIdentifier("ic_launcher_round", "mipmap", context.packageName)
        if (resId != 0) {
            imageView.setImageResource(resId)
        }
        addView(imageView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        // Removed badge text as requested by user
    }

    fun setState(state: String) {
        // Just keep the logo visible, no text overlays needed for states
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val layoutParams = layoutParams as WindowManager.LayoutParams

        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                initialX = layoutParams.x
                initialY = layoutParams.y
                initialTouchX = event.rawX
                initialTouchY = event.rawY
                isDragging = false
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.rawX - initialTouchX
                val dy = event.rawY - initialTouchY

                if (!isDragging && (abs(dx) > touchSlop || abs(dy) > touchSlop)) {
                    isDragging = true
                }

                if (isDragging) {
                    layoutParams.x = initialX + dx.toInt()
                    layoutParams.y = initialY + dy.toInt()
                    windowManager.updateViewLayout(this, layoutParams)
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                if (!isDragging) {
                    onTabAction()
                } else {
                    snapToEdge(layoutParams)
                }
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun snapToEdge(layoutParams: WindowManager.LayoutParams) {
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getMetrics(metrics)
        val screenWidth = metrics.widthPixels

        val middle = screenWidth / 2
        val targetX = if (layoutParams.x + (width / 2) < middle) 0 else screenWidth - width

        val animator = ValueAnimator.ofInt(layoutParams.x, targetX)
        animator.duration = 200
        animator.addUpdateListener { animation ->
            layoutParams.x = animation.animatedValue as Int
            windowManager.updateViewLayout(this, layoutParams)
        }
        animator.start()
    }
}
